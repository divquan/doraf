import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  WalletHoldState,
  WithdrawalPayoutMethod,
  WithdrawalState,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OtpTokenService } from '../agent-access/otp-token.service';
import { PhoneProtectionService } from '../agent-access/phone-protection.service';
import {
  PaymentGatewayService,
  PaymentProviderRequestException,
  type ProviderTransferResult,
} from '../payments/payment-gateway.service';
import type { InternalPrincipal } from '../internal-access/internal-access.types';
import { OutboxService } from '../operations/outbox.service';

const WITHDRAWAL_FEE_MINOR = 100n;
const MIN_WITHDRAWAL_MINOR = 1_000n;
const MAX_WITHDRAWAL_MINOR = 5_000_000n;

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpTokens: OtpTokenService,
    private readonly phones: PhoneProtectionService,
    private readonly payments: PaymentGatewayService,
    private readonly outbox: OutboxService,
  ) {}

  async request(input: {
    agentId: string;
    network: string;
    netAmountMinor: string;
    withdrawalToken: string;
  }) {
    let netAmountMinor: bigint;
    try {
      netAmountMinor = BigInt(input.netAmountMinor);
    } catch {
      throw new BadRequestException('Withdrawal amount is invalid');
    }
    if (
      netAmountMinor < MIN_WITHDRAWAL_MINOR ||
      netAmountMinor > MAX_WITHDRAWAL_MINOR
    ) {
      throw new BadRequestException(
        'Withdrawal amount must be between GHS 10.00 and GHS 50,000.00',
      );
    }
    const holdAmountMinor = netAmountMinor + WITHDRAWAL_FEE_MINOR;
    const now = new Date();

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const agent = await tx.agent.findUnique({
            where: { id: input.agentId },
            select: { status: true, phoneMask: true },
          });
          if (!agent || agent.status !== 'ACTIVE') {
            throw new ForbiddenException(
              'This agent cannot request a withdrawal',
            );
          }
          const challenge = await tx.otpChallenge.findUnique({
            where: {
              completionTokenFingerprint: Uint8Array.from(
                this.otpTokens.completionFingerprint(input.withdrawalToken),
              ),
            },
          });
          if (
            !challenge ||
            challenge.agentId !== input.agentId ||
            challenge.purpose !== 'AGENT_WITHDRAWAL' ||
            challenge.completedAt ||
            !challenge.completionExpiresAt ||
            challenge.completionExpiresAt <= now
          )
            throw new ForbiddenException(
              'A fresh withdrawal verification is required',
            );

          const wallet = await tx.walletAccount.findUnique({
            where: { agentId: input.agentId },
            select: { id: true },
          });
          if (!wallet)
            throw new ConflictException('No withdrawable balance is available');
          const [ledger, holds] = await Promise.all([
            tx.ledgerEntry.aggregate({
              where: { walletAccountId: wallet.id },
              _sum: { amountMinor: true },
            }),
            tx.walletHold.aggregate({
              where: {
                walletAccountId: wallet.id,
                state: WalletHoldState.ACTIVE,
              },
              _sum: { amountMinor: true },
            }),
          ]);
          const available =
            (ledger._sum.amountMinor ?? 0n) - (holds._sum.amountMinor ?? 0n);
          if (available < holdAmountMinor)
            throw new ConflictException('Insufficient withdrawable balance');
          const claimed = await tx.otpChallenge.updateMany({
            where: {
              id: challenge.id,
              completedAt: null,
              completionExpiresAt: { gt: now },
            },
            data: { completedAt: now },
          });
          if (claimed.count !== 1)
            throw new ConflictException(
              'Withdrawal verification was already used',
            );
          const activeRecipient = await tx.transferRecipient.findFirst({
            where: { agentId: input.agentId, active: true },
            select: {
              id: true,
              network: true,
              phoneMask: true,
              accountName: true,
              recipientCode: true,
            },
          });
          if (!activeRecipient) {
            throw new BadRequestException(
              'A validated Mobile Money payout destination must be set up before requesting a withdrawal',
            );
          }
          const destinationMask = activeRecipient.accountName
            ? `${activeRecipient.accountName} (${activeRecipient.phoneMask})`
            : activeRecipient.phoneMask;

          const created = await tx.withdrawal.create({
            data: {
              agentId: input.agentId,
              walletAccountId: wallet.id,
              destinationMask,
              network: activeRecipient.network,
              netAmountMinor,
              feeAmountMinor: WITHDRAWAL_FEE_MINOR,
              holdAmountMinor,
              hold: {
                create: {
                  walletAccountId: wallet.id,
                  amountMinor: holdAmountMinor,
                },
              },
            },
            select: {
              id: true,
              state: true,
              netAmountMinor: true,
              feeAmountMinor: true,
              holdAmountMinor: true,
              destinationMask: true,
              network: true,
              requestedAt: true,
            },
          });
          return serializeWithdrawal(created);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async listForAgent(agentId: string) {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { agentId },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        state: true,
        payoutMethod: true,
        manualReference: true,
        netAmountMinor: true,
        feeAmountMinor: true,
        holdAmountMinor: true,
        destinationMask: true,
        network: true,
        requestedAt: true,
        decidedAt: true,
        decisionReason: true,
      },
    });
    return withdrawals.map(serializeWithdrawal);
  }

  async listForAdmin() {
    const withdrawals = await this.prisma.withdrawal.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        state: true,
        payoutMethod: true,
        netAmountMinor: true,
        feeAmountMinor: true,
        holdAmountMinor: true,
        destinationMask: true,
        network: true,
        requestedAt: true,
        decisionReason: true,
        manualPaidAt: true,
        manualReference: true,
        agent: {
          select: { id: true, name: true, phoneMask: true, status: true },
        },
        manualPaidBy: {
          select: { displayName: true },
        },
        transferAttempts: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { providerStatus: true, updatedAt: true },
        },
      },
    });
    return withdrawals.map((withdrawal) => {
      const { transferAttempts, manualPaidBy, ...record } = withdrawal;
      return {
        ...serializeWithdrawal(record),
        manualPaidByName: manualPaidBy?.displayName ?? null,
        transferStatus: transferAttempts[0]?.providerStatus ?? null,
        transferUpdatedAt: transferAttempts[0]?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async decide(input: {
    withdrawalId: string;
    approve: boolean;
    reason: string;
    payoutMethod: WithdrawalPayoutMethod;
    actor: InternalPrincipal;
    requestId: string;
  }) {
    const now = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id: input.withdrawalId },
          include: { hold: true },
        });
        if (!withdrawal || withdrawal.state !== WithdrawalState.REQUESTED) {
          throw new ConflictException(
            'Withdrawal is no longer awaiting a decision',
          );
        }
        if (
          !withdrawal.hold ||
          withdrawal.hold.state !== WalletHoldState.ACTIVE
        ) {
          throw new ConflictException('Withdrawal hold is no longer active');
        }
        const manual = input.approve && input.payoutMethod === 'MANUAL';
        const canSubmit = input.approve
          ? await this.isStillEligible(tx, withdrawal)
          : false;
        const state = input.approve
          ? canSubmit
            ? manual
              ? WithdrawalState.AWAITING_MANUAL_PAYMENT
              : WithdrawalState.APPROVED
            : WithdrawalState.CANCELLED
          : WithdrawalState.REJECTED;
        const decided = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            state,
            payoutMethod: input.payoutMethod,
            approvedById: input.actor.userId,
            decisionReason: input.reason,
            decidedAt: now,
          },
        });
        if (!input.approve || !canSubmit) {
          await tx.walletHold.update({
            where: { id: withdrawal.hold.id },
            data: { state: WalletHoldState.RELEASED, releasedAt: now },
          });
        }
        await tx.auditEvent.create({
          data: {
            actorInternalUserId: input.actor.userId,
            actorRole: input.actor.role,
            action:
              state === WithdrawalState.APPROVED
                ? 'WITHDRAWAL_APPROVED'
                : state === WithdrawalState.AWAITING_MANUAL_PAYMENT
                  ? 'WITHDRAWAL_APPROVED'
                  : state === WithdrawalState.REJECTED
                    ? 'WITHDRAWAL_REJECTED'
                    : 'WITHDRAWAL_CANCELLED',
            entityType: 'WITHDRAWAL',
            entityId: withdrawal.id,
            reason: input.reason,
            authenticationStrength: input.actor.authenticationStrength,
            requestId: input.requestId,
            safeMetadata: {
              agentId: withdrawal.agentId,
              payoutMethod: input.payoutMethod,
              netAmountMinor: withdrawal.netAmountMinor.toString(),
              feeAmountMinor: withdrawal.feeAmountMinor.toString(),
            },
          },
        });
        if (state === WithdrawalState.APPROVED) {
          await this.outbox.enqueue(tx, {
            eventType: 'WITHDRAWAL_SUBMISSION_REQUIRED',
            aggregateType: 'WITHDRAWAL',
            aggregateId: withdrawal.id,
            aggregateVersion: 1,
            payload: { withdrawalId: withdrawal.id },
          });
        }
        return serializeWithdrawal(decided);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async markManualPaid(input: {
    withdrawalId: string;
    confirmedNetAmountMinor: string;
    reference: string;
    reason?: string;
    actor: InternalPrincipal;
    requestId: string;
  }) {
    const reference = input.reference.trim();
    if (reference.length < 3) {
      throw new BadRequestException(
        'Manual payout reference must contain at least 3 non-whitespace characters',
      );
    }
    let confirmedNetAmountMinor: bigint;
    try {
      confirmedNetAmountMinor = BigInt(input.confirmedNetAmountMinor);
    } catch {
      throw new BadRequestException('Confirmed payout amount is invalid');
    }
    const now = new Date();
    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const withdrawal = await tx.withdrawal.findUnique({
              where: { id: input.withdrawalId },
              include: { hold: { select: { id: true, state: true } } },
            });
            if (!withdrawal) {
              throw new ConflictException('Withdrawal was not found');
            }
            if (
              withdrawal.state === WithdrawalState.SUCCESS &&
              withdrawal.manualPaidAt
            ) {
              return serializeWithdrawal(withdrawal);
            }
            if (withdrawal.state !== WithdrawalState.AWAITING_MANUAL_PAYMENT) {
              throw new ConflictException(
                'Withdrawal is not awaiting a manual payout',
              );
            }
            if (
              !withdrawal.hold ||
              withdrawal.hold.state !== WalletHoldState.ACTIVE
            ) {
              throw new ConflictException(
                'Withdrawal hold is no longer active',
              );
            }
            if (confirmedNetAmountMinor !== withdrawal.netAmountMinor) {
              throw new BadRequestException(
                'Confirmed amount does not match the approved payout',
              );
            }
            await tx.ledgerEntry.createMany({
              skipDuplicates: true,
              data: [
                {
                  walletAccountId: withdrawal.walletAccountId,
                  type: 'PAYOUT_DEBIT',
                  amountMinor: -withdrawal.netAmountMinor,
                  currency: withdrawal.currency,
                  sourceType: 'WITHDRAWAL_PAYOUT',
                  sourceId: withdrawal.id,
                },
                {
                  walletAccountId: withdrawal.walletAccountId,
                  type: 'PAYOUT_FEE_DEBIT',
                  amountMinor: -withdrawal.feeAmountMinor,
                  currency: withdrawal.currency,
                  sourceType: 'WITHDRAWAL_FEE',
                  sourceId: withdrawal.id,
                },
              ],
            });
            await tx.walletHold.update({
              where: { id: withdrawal.hold.id },
              data: { state: WalletHoldState.CONSUMED, consumedAt: now },
            });
            const paid = await tx.withdrawal.update({
              where: { id: withdrawal.id },
              data: {
                state: WithdrawalState.SUCCESS,
                manualPaidById: input.actor.userId,
                manualPaidAt: now,
                manualReference: reference,
                decisionReason:
                  input.reason?.trim() || withdrawal.decisionReason,
              },
            });
            await tx.auditEvent.create({
              data: {
                actorInternalUserId: input.actor.userId,
                actorRole: input.actor.role,
                action: 'WITHDRAWAL_MANUAL_PAID',
                entityType: 'WITHDRAWAL',
                entityId: withdrawal.id,
                reason: input.reason?.trim() || 'Manual payout confirmed',
                authenticationStrength: input.actor.authenticationStrength,
                requestId: input.requestId,
                safeMetadata: {
                  agentId: withdrawal.agentId,
                  payoutMethod: WithdrawalPayoutMethod.MANUAL,
                  reference,
                  netAmountMinor: withdrawal.netAmountMinor.toString(),
                  feeAmountMinor: withdrawal.feeAmountMinor.toString(),
                },
              },
            });
            return serializeWithdrawal(paid);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This manual payout reference has already been recorded',
        );
      }
      throw error;
    }
  }

  async cancelManualPending(input: {
    withdrawalId: string;
    reason?: string;
    actor: InternalPrincipal;
    requestId: string;
  }) {
    const now = new Date();
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const withdrawal = await tx.withdrawal.findUnique({
            where: { id: input.withdrawalId },
            include: { hold: { select: { id: true, state: true } } },
          });
          if (!withdrawal) {
            throw new ConflictException('Withdrawal was not found');
          }
          if (withdrawal.state === WithdrawalState.CANCELLED) {
            return serializeWithdrawal(withdrawal);
          }
          if (withdrawal.state !== WithdrawalState.AWAITING_MANUAL_PAYMENT) {
            throw new ConflictException(
              'Withdrawal is not awaiting a manual payout',
            );
          }
          if (
            !withdrawal.hold ||
            withdrawal.hold.state !== WalletHoldState.ACTIVE
          ) {
            throw new ConflictException('Withdrawal hold is no longer active');
          }
          const reason =
            input.reason?.trim() || 'Cancelled before manual payout';
          const cancelled = await tx.withdrawal.update({
            where: { id: withdrawal.id },
            data: { state: WithdrawalState.CANCELLED, decisionReason: reason },
          });
          await tx.walletHold.update({
            where: { id: withdrawal.hold.id },
            data: { state: WalletHoldState.RELEASED, releasedAt: now },
          });
          await tx.auditEvent.create({
            data: {
              actorInternalUserId: input.actor.userId,
              actorRole: input.actor.role,
              action: 'WITHDRAWAL_CANCELLED',
              entityType: 'WITHDRAWAL',
              entityId: withdrawal.id,
              reason,
              authenticationStrength: input.actor.authenticationStrength,
              requestId: input.requestId,
              safeMetadata: {
                agentId: withdrawal.agentId,
                payoutMethod: WithdrawalPayoutMethod.MANUAL,
                netAmountMinor: withdrawal.netAmountMinor.toString(),
                feeAmountMinor: withdrawal.feeAmountMinor.toString(),
              },
            },
          });
          return serializeWithdrawal(cancelled);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async submitApproved(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { agent: true, transferAttempts: { take: 1 }, hold: true },
    });
    if (!withdrawal || withdrawal.state !== WithdrawalState.APPROVED) return;
    if (!withdrawal.hold || withdrawal.hold.state !== WalletHoldState.ACTIVE)
      return;
    if (!(await this.isStillEligible(this.prisma, withdrawal))) {
      await this.releaseBeforeSubmission(withdrawal.id, withdrawal.hold.id);
      return;
    }
    const reference = `dashchecker_wd_${withdrawal.id.replaceAll('-', '')}`;
    let recipient: string;
    try {
      recipient = await this.findOrCreateRecipient(withdrawal);
    } catch (error) {
      if (
        error instanceof PaymentProviderRequestException &&
        error.kind === 'definitive'
      ) {
        await this.failBeforeSubmission(withdrawal.id, withdrawal.hold.id);
      }
      throw error;
    }
    const attempt = await this.prisma.transferAttempt.upsert({
      where: { withdrawalId },
      create: {
        withdrawalId,
        providerReference: reference,
        recipientCode: recipient,
        providerStatus: 'creating',
      },
      update: {},
    });
    const claimed = await this.prisma.transferAttempt.updateMany({
      where: { id: attempt.id, providerStatus: 'creating' },
      data: { providerStatus: 'submitting' },
    });
    if (claimed.count !== 1) return;
    try {
      const result = await this.payments.initiateTransfer({
        reference,
        recipientCode: recipient,
        amountMinor: withdrawal.netAmountMinor,
        reason: `Dashchecker withdrawal ${withdrawal.id}`,
      });
      await this.recordProviderResult(withdrawalId, reference, result);
    } catch (error) {
      if (!(error instanceof PaymentProviderRequestException)) throw error;
      const ambiguous = error.kind === 'ambiguous';
      this.logger.warn(
        `Paystack transfer submission ${ambiguous ? 'ambiguous' : 'failed'} withdrawalId=${withdrawalId} reference=${reference} reason=${safeErrorMessage(error)}`,
      );
      await this.prisma.$transaction([
        this.prisma.transferAttempt.update({
          where: { id: attempt.id },
          data: { providerStatus: ambiguous ? 'unknown' : 'failed' },
        }),
        this.prisma.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            state: ambiguous ? WithdrawalState.PENDING : WithdrawalState.FAILED,
            ...(!ambiguous
              ? { decisionReason: 'Paystack could not complete the transfer' }
              : {}),
          },
        }),
        ...(ambiguous
          ? []
          : [
              this.prisma.walletHold.update({
                where: { withdrawalId },
                data: {
                  state: WalletHoldState.RELEASED,
                  releasedAt: new Date(),
                },
              }),
            ]),
      ]);
      throw error;
    }
  }

  async settleTransfer(result: ProviderTransferResult) {
    const normalized = result.status.toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.transferAttempt.findUnique({
        where: { providerReference: result.reference },
        include: { withdrawal: { include: { hold: true } } },
      });
      if (!attempt) return;
      const withdrawal = attempt.withdrawal;
      const hold = withdrawal.hold;
      if (!hold) return;
      if (withdrawal.state === WithdrawalState.REVERSED) return;
      if (
        withdrawal.state === WithdrawalState.SUCCESS &&
        normalized !== 'reversed'
      ) {
        return;
      }
      if (
        withdrawal.state === WithdrawalState.FAILED &&
        normalized !== 'failed'
      ) {
        return;
      }
      if (
        result.amountMinor !== null &&
        result.amountMinor !== withdrawal.netAmountMinor
      ) {
        throw new ConflictException(
          'Transfer amount does not match withdrawal',
        );
      }
      if (result.currency !== null && result.currency !== withdrawal.currency) {
        throw new ConflictException(
          'Transfer currency does not match withdrawal',
        );
      }
      if (normalized === 'success' && hold.state === WalletHoldState.ACTIVE) {
        await tx.ledgerEntry.createMany({
          skipDuplicates: true,
          data: [
            {
              walletAccountId: withdrawal.walletAccountId,
              type: 'PAYOUT_DEBIT',
              amountMinor: -withdrawal.netAmountMinor,
              currency: withdrawal.currency,
              sourceType: 'WITHDRAWAL_PAYOUT',
              sourceId: withdrawal.id,
            },
            {
              walletAccountId: withdrawal.walletAccountId,
              type: 'PAYOUT_FEE_DEBIT',
              amountMinor: -withdrawal.feeAmountMinor,
              currency: withdrawal.currency,
              sourceType: 'WITHDRAWAL_FEE',
              sourceId: withdrawal.id,
            },
          ],
        });
        await tx.walletHold.update({
          where: { id: hold.id },
          data: { state: WalletHoldState.CONSUMED, consumedAt: new Date() },
        });
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: { state: WithdrawalState.SUCCESS },
        });
      } else if (
        normalized === 'reversed' &&
        hold.state === WalletHoldState.CONSUMED
      ) {
        await tx.ledgerEntry.createMany({
          skipDuplicates: true,
          data: [
            {
              walletAccountId: withdrawal.walletAccountId,
              type: 'PAYOUT_COMPENSATION_CREDIT',
              amountMinor: withdrawal.netAmountMinor,
              currency: withdrawal.currency,
              sourceType: 'WITHDRAWAL_REVERSAL',
              sourceId: withdrawal.id,
            },
          ],
        });
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            state: WithdrawalState.REVERSED,
            decisionReason: 'Paystack returned the transferred funds',
          },
        });
      } else if (
        ['failed', 'reversed'].includes(normalized) &&
        hold.state === WalletHoldState.ACTIVE
      ) {
        await tx.walletHold.update({
          where: { id: hold.id },
          data: { state: WalletHoldState.RELEASED, releasedAt: new Date() },
        });
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            state:
              normalized === 'reversed'
                ? WithdrawalState.REVERSED
                : WithdrawalState.FAILED,
            decisionReason:
              normalized === 'reversed'
                ? 'Paystack returned the transferred funds'
                : 'Paystack could not complete the transfer',
          },
        });
      }
      await tx.transferAttempt.update({
        where: { id: attempt.id },
        data: {
          providerStatus: normalized,
          ...(result.transferCode ? { transferCode: result.transferCode } : {}),
        },
      });
    });
  }

  async verifyTransfer(withdrawalId: string) {
    const attempt = await this.prisma.transferAttempt.findFirst({
      where: { withdrawalId },
      orderBy: { createdAt: 'desc' },
      select: { providerReference: true },
    });
    if (!attempt)
      throw new ConflictException('Transfer has not been submitted');
    const result = await this.payments.verifyTransfer(
      attempt.providerReference,
    );
    await this.recordProviderResult(withdrawalId, result.reference, result);
    return serializeTransferResult(result);
  }

  async reconcileReference(reference: string) {
    const attempt = await this.prisma.transferAttempt.findUnique({
      where: { providerReference: reference },
      select: { withdrawalId: true },
    });
    if (!attempt) return;
    const result = await this.payments.verifyTransfer(reference);
    await this.recordProviderResult(attempt.withdrawalId, reference, result);
  }

  async finalizeMerchantOtp(withdrawalId: string, otp: string) {
    const attempt = await this.prisma.transferAttempt.findUnique({
      where: { withdrawalId },
      include: { withdrawal: { select: { state: true } } },
    });
    if (
      !attempt?.transferCode ||
      attempt.withdrawal.state !== WithdrawalState.AWAITING_MERCHANT_OTP
    ) {
      throw new ConflictException('Transfer is not awaiting merchant OTP');
    }
    const result = await this.payments.finalizeTransfer({
      transferCode: attempt.transferCode,
      otp,
      reference: attempt.providerReference,
    });
    await this.recordProviderResult(
      withdrawalId,
      attempt.providerReference,
      result,
    );
    return serializeTransferResult(result);
  }

  private async recordProviderResult(
    withdrawalId: string,
    reference: string,
    result: ProviderTransferResult,
  ) {
    const status = result.status.toLowerCase();
    if (['success', 'failed', 'reversed'].includes(status)) {
      await this.settleTransfer(result);
      return;
    }
    await this.prisma.$transaction([
      this.prisma.transferAttempt.update({
        where: { providerReference: reference },
        data: {
          ...(result.transferCode ? { transferCode: result.transferCode } : {}),
          providerStatus: status,
        },
      }),
      this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          state:
            status === 'otp'
              ? WithdrawalState.AWAITING_MERCHANT_OTP
              : WithdrawalState.PENDING,
        },
      }),
    ]);
  }

  private async isStillEligible(
    db: Pick<Prisma.TransactionClient, 'agent' | 'ledgerEntry' | 'walletHold'>,
    withdrawal: {
      agentId: string;
      walletAccountId: string;
      holdAmountMinor: bigint;
    },
  ) {
    const [agent, ledger, holds] = await Promise.all([
      db.agent.findUnique({
        where: { id: withdrawal.agentId },
        select: { status: true },
      }),
      db.ledgerEntry.aggregate({
        where: { walletAccountId: withdrawal.walletAccountId },
        _sum: { amountMinor: true },
      }),
      db.walletHold.aggregate({
        where: {
          walletAccountId: withdrawal.walletAccountId,
          state: WalletHoldState.ACTIVE,
        },
        _sum: { amountMinor: true },
      }),
    ]);
    return (
      agent?.status === 'ACTIVE' &&
      (ledger._sum.amountMinor ?? 0n) >= (holds._sum.amountMinor ?? 0n) &&
      withdrawal.holdAmountMinor > 0n
    );
  }

  private releaseBeforeSubmission(withdrawalId: string, holdId: string) {
    const now = new Date();
    return this.prisma.$transaction([
      this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          state: WithdrawalState.CANCELLED,
          decisionReason: 'Wallet eligibility changed before transfer',
        },
      }),
      this.prisma.walletHold.update({
        where: { id: holdId },
        data: { state: WalletHoldState.RELEASED, releasedAt: now },
      }),
    ]);
  }

  private failBeforeSubmission(withdrawalId: string, holdId: string) {
    const now = new Date();
    return this.prisma.$transaction([
      this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          state: WithdrawalState.FAILED,
          decisionReason: 'Paystack could not create the transfer destination',
        },
      }),
      this.prisma.walletHold.update({
        where: { id: holdId },
        data: { state: WalletHoldState.RELEASED, releasedAt: now },
      }),
    ]);
  }

  async getPayoutDestination(agentId: string) {
    const activeRecipient = await this.prisma.transferRecipient.findFirst({
      where: { agentId, active: true },
      select: {
        id: true,
        network: true,
        accountName: true,
        phoneMask: true,
        createdAt: true,
      },
    });
    if (!activeRecipient) return null;
    return {
      id: activeRecipient.id,
      network: activeRecipient.network,
      accountName: activeRecipient.accountName ?? '',
      phoneMask: activeRecipient.phoneMask,
      createdAt: activeRecipient.createdAt.toISOString(),
    };
  }

  async validatePayoutDestination(
    agentId: string,
    input: { network: string; accountNumber: string },
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true },
    });
    if (!agent || agent.status !== 'ACTIVE') {
      throw new ForbiddenException('Agent account is not active');
    }
    const resolved = await this.payments.resolveAccount({
      accountNumber: input.accountNumber,
      network: input.network,
    });
    const protectedPhone = this.phones.protect(input.accountNumber);
    return {
      network: input.network,
      accountNumberMask: protectedPhone.mask,
      accountName: resolved.accountName,
    };
  }

  async savePayoutDestination(
    agentId: string,
    input: { network: string; accountNumber: string },
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { status: true, name: true },
    });
    if (!agent || agent.status !== 'ACTIVE') {
      throw new ForbiddenException('Agent account is not active');
    }
    const resolved = await this.payments.resolveAccount({
      accountNumber: input.accountNumber,
      network: input.network,
    });
    const recipient = await this.payments.createMobileMoneyRecipient({
      name: resolved.accountName,
      phone: input.accountNumber,
      network: input.network,
    });
    const protectedPhone = this.phones.protect(input.accountNumber);

    await this.prisma.$transaction([
      this.prisma.transferRecipient.updateMany({
        where: { agentId, active: true },
        data: { active: false },
      }),
      this.prisma.transferRecipient.create({
        data: {
          agentId,
          network: input.network,
          accountName: resolved.accountName,
          phoneCiphertext: Uint8Array.from(protectedPhone.ciphertext),
          phoneFingerprint: Uint8Array.from(protectedPhone.fingerprint),
          phoneMask: protectedPhone.mask,
          recipientCode: recipient.recipientCode,
          active: true,
        },
      }),
    ]);

    return {
      network: input.network,
      accountName: resolved.accountName,
      phoneMask: protectedPhone.mask,
    };
  }

  private async findOrCreateRecipient(withdrawal: {
    agent: {
      id: string;
      name: string;
      phoneCiphertext: Uint8Array;
      phoneMask: string;
      phoneFingerprint: Uint8Array;
    };
    network: string;
  }) {
    const activeRecipient = await this.prisma.transferRecipient.findFirst({
      where: {
        agentId: withdrawal.agent.id,
        active: true,
      },
      select: { id: true, recipientCode: true },
    });
    if (activeRecipient) return activeRecipient.recipientCode;

    const current = await this.prisma.transferRecipient.findFirst({
      where: {
        agentId: withdrawal.agent.id,
        network: withdrawal.network,
        phoneFingerprint: Uint8Array.from(withdrawal.agent.phoneFingerprint),
      },
      select: { id: true, recipientCode: true, active: true },
    });
    if (current?.active) return current.recipientCode;
    if (current) {
      await this.prisma.$transaction([
        this.prisma.transferRecipient.updateMany({
          where: {
            agentId: withdrawal.agent.id,
            network: withdrawal.network,
            active: true,
          },
          data: { active: false },
        }),
        this.prisma.transferRecipient.update({
          where: { id: current.id },
          data: { active: true },
        }),
      ]);
      return current.recipientCode;
    }
    const recipient = await this.payments.createMobileMoneyRecipient({
      name: withdrawal.agent.name,
      phone: this.phones.decrypt(withdrawal.agent.phoneCiphertext),
      network: withdrawal.network,
    });
    try {
      await this.prisma.$transaction([
        this.prisma.transferRecipient.updateMany({
          where: {
            agentId: withdrawal.agent.id,
            network: withdrawal.network,
            active: true,
          },
          data: { active: false },
        }),
        this.prisma.transferRecipient.create({
          data: {
            agentId: withdrawal.agent.id,
            network: withdrawal.network,
            phoneMask: withdrawal.agent.phoneMask,
            phoneFingerprint: Uint8Array.from(
              withdrawal.agent.phoneFingerprint,
            ),
            recipientCode: recipient.recipientCode,
          },
        }),
      ]);
      return recipient.recipientCode;
    } catch (error) {
      const raced = await this.prisma.transferRecipient.findFirst({
        where: {
          agentId: withdrawal.agent.id,
          network: withdrawal.network,
          phoneFingerprint: Uint8Array.from(withdrawal.agent.phoneFingerprint),
          active: true,
        },
        select: { recipientCode: true },
      });
      if (raced) return raced.recipientCode;
      throw error;
    }
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          attempt === 3 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034'
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException('Withdrawal request could not be completed');
  }
}

function serializeWithdrawal<
  T extends {
    netAmountMinor: bigint;
    feeAmountMinor: bigint;
    holdAmountMinor: bigint;
    requestedAt: Date;
    decidedAt?: Date | null;
    manualPaidAt?: Date | null;
  },
>(withdrawal: T) {
  return {
    ...withdrawal,
    netAmountMinor: withdrawal.netAmountMinor.toString(),
    feeAmountMinor: withdrawal.feeAmountMinor.toString(),
    holdAmountMinor: withdrawal.holdAmountMinor.toString(),
    requestedAt: withdrawal.requestedAt.toISOString(),
    ...(Object.hasOwn(withdrawal, 'decidedAt')
      ? { decidedAt: withdrawal.decidedAt?.toISOString() ?? null }
      : {}),
    ...(Object.hasOwn(withdrawal, 'manualPaidAt')
      ? { manualPaidAt: withdrawal.manualPaidAt?.toISOString() ?? null }
      : {}),
  };
}

function serializeTransferResult(result: ProviderTransferResult) {
  return {
    ...result,
    amountMinor: result.amountMinor?.toString() ?? null,
  };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof PaymentProviderRequestException) {
    return `${error.providerStatusCode ?? 'network'}:${error.providerMessage}`.slice(
      0,
      300,
    );
  }
  return error instanceof Error ? error.message.slice(0, 300) : 'unknown';
}
