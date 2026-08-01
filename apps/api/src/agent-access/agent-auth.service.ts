import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AppEnvironment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import { OtpPurpose, type OtpChallenge } from '../generated/prisma/client';
import { SessionTokenService } from '../internal-access/session-token.service';
import {
  SMS_OTP_SENDER,
  type AgentSessionResult,
  type ProtectedPhone,
  type SmsOtpSender,
} from './agent-access.types';
import { OtpTokenService } from './otp-token.service';
import { PhoneProtectionService } from './phone-protection.service';

export interface OtpRequestResult {
  challengeId: string;
  expiresAt: Date;
  phoneMask: string;
}

@Injectable()
export class AgentAuthService {
  private readonly logger = new Logger(AgentAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly phones: PhoneProtectionService,
    private readonly otpTokens: OtpTokenService,
    private readonly sessionTokens: SessionTokenService,
    @Inject(SMS_OTP_SENDER) private readonly sms: SmsOtpSender,
  ) {}

  async requestRegistrationOtp(phoneValue: string): Promise<OtpRequestResult> {
    const phone = this.phones.protect(phoneValue);
    const existing = await this.prisma.agent.findUnique({
      where: { phoneFingerprint: Uint8Array.from(phone.fingerprint) },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An agent account already exists for this phone number',
      );
    }
    return this.createChallenge(OtpPurpose.AGENT_REGISTRATION, phone, null);
  }

  async requestLoginOtp(phoneValue: string): Promise<OtpRequestResult> {
    const phone = this.phones.protect(phoneValue);
    const agent = await this.prisma.agent.findUnique({
      where: { phoneFingerprint: Uint8Array.from(phone.fingerprint) },
      select: { id: true },
    });

    if (!agent) {
      if (this.config.get('NODE_ENV', { infer: true }) === 'development') {
        this.logger.log(
          `Development login OTP not sent: no agent account for ${phone.mask}`,
        );
      }

      return {
        challengeId: randomUUID(),
        expiresAt: this.future('AGENT_AUTH_OTP_TTL_SECONDS'),
        phoneMask: phone.mask,
      };
    }
    return this.createChallenge(OtpPurpose.AGENT_SIGN_IN, phone, agent.id);
  }

  async requestWithdrawalOtp(agentId: string): Promise<OtpRequestResult> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        phoneCiphertext: true,
        phoneFingerprint: true,
        phoneMask: true,
        encryptionKeyId: true,
        formatVersion: true,
      },
    });
    if (!agent) throw new UnauthorizedException('Authentication required');
    return this.createChallenge(
      OtpPurpose.AGENT_WITHDRAWAL,
      {
        normalized: '',
        ciphertext: Buffer.from(agent.phoneCiphertext),
        fingerprint: Buffer.from(agent.phoneFingerprint),
        mask: agent.phoneMask,
        encryptionKeyId: agent.encryptionKeyId,
        formatVersion: agent.formatVersion,
      },
      agentId,
    );
  }

  async verifyWithdrawalOtp(
    agentId: string,
    challengeId: string,
    code: string,
  ) {
    const challenge = await this.findUsableChallenge(
      challengeId,
      OtpPurpose.AGENT_WITHDRAWAL,
    );
    if (challenge.agentId !== agentId) throw this.invalidOtp();
    await this.assertCode(challenge, code);
    const completion = this.otpTokens.createCompletionToken();
    const now = new Date();
    const expiresAt = this.future('AGENT_AUTH_OTP_TTL_SECONDS', now);
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
      data: {
        consumedAt: now,
        completionTokenFingerprint: Uint8Array.from(completion.fingerprint),
        completionExpiresAt: expiresAt,
      },
    });
    if (consumed.count !== 1) throw this.invalidOtp();
    return { withdrawalToken: completion.token, expiresAt };
  }

  async verifyRegistrationOtp(
    challengeId: string,
    code: string,
  ): Promise<{ registrationToken: string; expiresAt: Date }> {
    const challenge = await this.findUsableChallenge(
      challengeId,
      OtpPurpose.AGENT_REGISTRATION,
    );
    await this.assertCode(challenge, code);

    const completion = this.otpTokens.createCompletionToken();
    const now = new Date();
    const expiresAt = this.future('AGENT_AUTH_REGISTRATION_TTL_SECONDS', now);
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: challenge.maxAttempts },
      },
      data: {
        consumedAt: now,
        completionTokenFingerprint: Uint8Array.from(completion.fingerprint),
        completionExpiresAt: expiresAt,
      },
    });
    if (consumed.count !== 1) {
      throw this.invalidOtp();
    }
    return { registrationToken: completion.token, expiresAt };
  }

  async completeRegistration(
    registrationToken: string,
    nameValue: string,
  ): Promise<AgentSessionResult> {
    const now = new Date();
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: {
        completionTokenFingerprint: Uint8Array.from(
          this.otpTokens.completionFingerprint(registrationToken),
        ),
      },
    });
    if (
      !challenge ||
      challenge.purpose !== OtpPurpose.AGENT_REGISTRATION ||
      !challenge.consumedAt ||
      challenge.completedAt ||
      !challenge.completionExpiresAt ||
      challenge.completionExpiresAt <= now
    ) {
      throw new UnauthorizedException('Registration session is invalid');
    }

    const name = nameValue.trim();
    const session = this.sessionTokens.create();
    const expiresAt = this.future('AGENT_AUTH_SESSION_TTL_SECONDS', now);

    return this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          completedAt: null,
          completionExpiresAt: { gt: now },
        },
        data: { completedAt: now },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException('Registration session is invalid');
      }

      const agent = await transaction.agent.create({
        data: {
          name,
          phoneCiphertext: challenge.phoneCiphertext,
          phoneFingerprint: challenge.phoneFingerprint,
          phoneMask: challenge.phoneMask,
          encryptionKeyId: challenge.encryptionKeyId,
          formatVersion: challenge.formatVersion,
          tenant: { create: {} },
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          phoneMask: true,
          status: true,
        },
      });
      await transaction.session.create({
        data: {
          agentId: agent.id,
          tokenFingerprint: Uint8Array.from(session.fingerprint),
          authenticationStrength: 'OTP',
          authenticatedAt: now,
          expiresAt,
        },
      });
      return { token: session.token, expiresAt, agent };
    });
  }

  async verifyLoginOtp(
    challengeId: string,
    code: string,
  ): Promise<AgentSessionResult> {
    const challenge = await this.findUsableChallenge(
      challengeId,
      OtpPurpose.AGENT_SIGN_IN,
    );
    if (!challenge.agentId) {
      throw this.invalidOtp();
    }
    await this.assertCode(challenge, code);

    const now = new Date();
    const session = this.sessionTokens.create();
    const expiresAt = this.future('AGENT_AUTH_SESSION_TTL_SECONDS', now);
    return this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: now },
          attemptCount: { lt: challenge.maxAttempts },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw this.invalidOtp();
      }
      const agent = await transaction.agent.findUnique({
        where: { id: challenge.agentId! },
        select: {
          id: true,
          tenantId: true,
          name: true,
          phoneMask: true,
          status: true,
        },
      });
      if (!agent) {
        throw this.invalidOtp();
      }
      await transaction.session.create({
        data: {
          agentId: agent.id,
          tokenFingerprint: Uint8Array.from(session.fingerprint),
          authenticationStrength: 'OTP',
          authenticatedAt: now,
          expiresAt,
        },
      });
      return { token: session.token, expiresAt, agent };
    });
  }

  revokeSession(sessionId: string): Promise<unknown> {
    return this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createChallenge(
    purpose: OtpPurpose,
    phone: ProtectedPhone,
    agentId: string | null,
  ): Promise<OtpRequestResult> {
    const id = randomUUID();
    const code = this.otpTokens.createCode();
    const expiresAt = this.future('AGENT_AUTH_OTP_TTL_SECONDS');
    const maxAttempts = this.config.get('AGENT_AUTH_OTP_MAX_ATTEMPTS', {
      infer: true,
    });

    await this.prisma.$transaction([
      this.prisma.otpChallenge.updateMany({
        where: {
          phoneFingerprint: Uint8Array.from(phone.fingerprint),
          purpose,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpChallenge.create({
        data: {
          id,
          purpose,
          agentId,
          phoneCiphertext: Uint8Array.from(phone.ciphertext),
          phoneFingerprint: Uint8Array.from(phone.fingerprint),
          phoneMask: phone.mask,
          encryptionKeyId: phone.encryptionKeyId,
          formatVersion: phone.formatVersion,
          verifierFingerprint: Uint8Array.from(
            this.otpTokens.codeFingerprint(id, code),
          ),
          maxAttempts,
          expiresAt,
        },
      }),
    ]);
    await this.sms.send(`+${phone.normalized}`, code);

    return {
      challengeId: id,
      expiresAt,
      phoneMask: phone.mask,
    };
  }

  private async findUsableChallenge(id: string, purpose: OtpPurpose) {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { id },
    });
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attemptCount >= challenge.maxAttempts
    ) {
      throw this.invalidOtp();
    }
    return challenge;
  }

  private async assertCode(
    challenge: OtpChallenge,
    code: string,
  ): Promise<void> {
    if (
      this.otpTokens.codeMatches(
        challenge.id,
        code,
        challenge.verifierFingerprint,
      )
    ) {
      return;
    }
    await this.prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        attemptCount: { lt: challenge.maxAttempts },
      },
      data: { attemptCount: { increment: 1 } },
    });
    throw this.invalidOtp();
  }

  private future(
    setting:
      | 'AGENT_AUTH_OTP_TTL_SECONDS'
      | 'AGENT_AUTH_REGISTRATION_TTL_SECONDS'
      | 'AGENT_AUTH_SESSION_TTL_SECONDS',
    from = new Date(),
  ): Date {
    return new Date(
      from.getTime() + this.config.get(setting, { infer: true }) * 1_000,
    );
  }

  private invalidOtp(): UnauthorizedException {
    return new UnauthorizedException('The verification code is invalid');
  }
}
