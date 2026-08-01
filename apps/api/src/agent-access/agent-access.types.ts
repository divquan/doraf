import type { AgentStatus } from '../generated/prisma/client';

export const SMS_OTP_SENDER = Symbol('SMS_OTP_SENDER');

export interface SmsOtpSender {
  send(destination: string, code: string): Promise<void>;
}

export interface ProtectedPhone {
  normalized: string;
  ciphertext: Buffer;
  fingerprint: Buffer;
  mask: string;
  encryptionKeyId: string;
  formatVersion: number;
}

export interface AgentPrincipal {
  agentId: string;
  tenantId: string;
  sessionId: string;
  name: string;
  phoneMask: string;
  status: AgentStatus;
  authenticatedAt: Date;
}

export interface AgentSessionResult {
  token: string;
  expiresAt: Date;
  agent: {
    id: string;
    tenantId: string;
    name: string;
    phoneMask: string;
    status: AgentStatus;
  };
}
