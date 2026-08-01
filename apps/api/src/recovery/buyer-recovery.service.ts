import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import {
  SMS_OTP_SENDER,
  type SmsOtpSender,
} from '../agent-access/agent-access.types';
import { OrderContactProtectionService } from '../orders/order-contact-protection.service';
import { BuyerRecoveryTokenService } from './buyer-recovery-token.service';
import { VoucherRevealService } from './voucher-reveal.service';

const RECOVERY_SESSION_MS = 10 * 60_000;

@Injectable()
export class BuyerRecoveryService {
  private readonly logger = new Logger(BuyerRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly tokens: BuyerRecoveryTokenService,
    private readonly contacts: OrderContactProtectionService,
    private readonly vouchers: VoucherRevealService,
    @Inject(SMS_OTP_SENDER) private readonly sms: SmsOtpSender,
  ) {}

  async request(orderReference: string) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        this.config.get('AGENT_AUTH_OTP_TTL_SECONDS', { infer: true }) * 1_000,
    );
    const maxAttempts = this.config.get('AGENT_AUTH_OTP_MAX_ATTEMPTS', {
      infer: true,
    });
    const order = await this.prisma.order.findFirst({
      where: {
        publicReference: orderReference.trim(),
        paymentState: 'PAID',
        fulfillmentState: { in: ['COMPLETE', 'PARTIALLY_REPLACED'] },
      },
      select: {
        id: true,
        deliveryPhoneCiphertext: true,
      },
    });
    const challengeId = randomUUID();
    const code = this.tokens.createCode();
    await this.prisma.$transaction(async (transaction) => {
      if (order) {
        await transaction.buyerRecoveryChallenge.updateMany({
          where: { orderId: order.id, consumedAt: null },
          data: { consumedAt: now },
        });
      }
      await transaction.buyerRecoveryChallenge.create({
        data: {
          id: challengeId,
          orderId: order?.id,
          verifierFingerprint: this.tokens.codeFingerprint(challengeId, code),
          maxAttempts,
          expiresAt,
          events: {
            create: {
              orderId: order?.id,
              eventType: 'RECOVERY_REQUESTED',
              safeMetadata: { matchedOrder: Boolean(order) },
            },
          },
        },
      });
    });
    if (order) {
      try {
        const phone = this.contacts.revealPhone(
          order.deliveryPhoneCiphertext,
          'delivery',
        );
        await this.sms.send(`+${phone}`, code);
      } catch {
        this.logger.warn(
          `Buyer recovery OTP delivery deferred challengeId=${challengeId}`,
        );
      }
    }
    return { accepted: true, challengeId, expiresAt };
  }

  async verify(challengeId: string, code: string) {
    const now = new Date();
    const challenge = await this.prisma.buyerRecoveryChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      !challenge ||
      !challenge.orderId ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.attemptCount >= challenge.maxAttempts
    ) {
      throw this.invalidCode();
    }
    if (
      !this.tokens.codeMatches(
        challenge.id,
        code,
        challenge.verifierFingerprint,
      )
    ) {
      await this.prisma.buyerRecoveryChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attemptCount: { lt: challenge.maxAttempts },
        },
        data: { attemptCount: { increment: 1 } },
      });
      throw this.invalidCode();
    }
    const recovery = this.tokens.createRecoveryToken();
    const recoveryExpiresAt = new Date(now.getTime() + RECOVERY_SESSION_MS);
    const consumed = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.buyerRecoveryChallenge.updateMany({
        where: {
          id: challenge.id,
          orderId: challenge.orderId,
          consumedAt: null,
          expiresAt: { gt: now },
          attemptCount: { lt: challenge.maxAttempts },
        },
        data: {
          consumedAt: now,
          recoveryTokenFingerprint: recovery.fingerprint,
          recoveryExpiresAt,
        },
      });
      if (result.count === 1) {
        await transaction.buyerRecoveryEvent.create({
          data: {
            challengeId: challenge.id,
            orderId: challenge.orderId,
            eventType: 'RECOVERY_VERIFIED',
          },
        });
      }
      return result.count;
    });
    if (consumed !== 1) throw this.invalidCode();
    return { recoveryToken: recovery.token, expiresAt: recoveryExpiresAt };
  }

  async reveal(token: string) {
    const now = new Date();
    const challenge = await this.prisma.buyerRecoveryChallenge.findUnique({
      where: { recoveryTokenFingerprint: this.tokens.tokenFingerprint(token) },
      include: {
        order: {
          include: {
            product: { select: { code: true, name: true } },
            items: {
              orderBy: { position: 'asc' },
              include: {
                allocation: {
                  include: { voucher: { include: { batch: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (
      !challenge?.order ||
      !challenge.recoveryExpiresAt ||
      challenge.recoveryExpiresAt <= now
    ) {
      throw new UnauthorizedException('Recovery access has expired');
    }
    const items = challenge.order.items.map((item) => {
      const voucher = item.allocation?.voucher;
      if (!voucher) throw new UnauthorizedException('Order is not recoverable');
      return { position: item.position, ...this.vouchers.reveal(voucher) };
    });
    await this.prisma.$transaction([
      this.prisma.buyerRecoveryChallenge.update({
        where: { id: challenge.id },
        data: { recoveredAt: now },
      }),
      this.prisma.buyerRecoveryEvent.create({
        data: {
          challengeId: challenge.id,
          orderId: challenge.order.id,
          eventType: 'VOUCHERS_REVEALED',
          safeMetadata: { voucherCount: items.length },
        },
      }),
    ]);
    return {
      orderReference: challenge.order.publicReference,
      product: challenge.order.product,
      vouchers: items,
      usageReminder:
        'Each checker supports three checks and locks to one candidate and examination year after first use.',
    };
  }

  private invalidCode() {
    return new UnauthorizedException('The verification code is invalid');
  }
}
