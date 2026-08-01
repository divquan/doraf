import { AgentAuthService } from './agent-auth.service';
import type { ProtectedPhone } from './agent-access.types';

const phone: ProtectedPhone = {
  normalized: '233241234567',
  ciphertext: Buffer.from('ciphertext'),
  fingerprint: Buffer.alloc(32, 1),
  mask: '+233 •• ••• 4567',
  encryptionKeyId: 'master-key:v1',
  formatVersion: 1,
};

describe('AgentAuthService OTP requests', () => {
  function createService() {
    const prisma = {
      agent: { findUnique: jest.fn() },
      otpChallenge: { updateMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'AGENT_AUTH_OTP_TTL_SECONDS') return 300;
        if (key === 'AGENT_AUTH_OTP_MAX_ATTEMPTS') return 5;
        return 0;
      }),
    };
    const phones = { protect: jest.fn(() => phone) };
    const otpTokens = {
      createCode: jest.fn(() => '123456'),
      codeFingerprint: jest.fn(() => Buffer.alloc(32, 2)),
    };
    const sessions = { create: jest.fn() };
    const sms = { send: jest.fn().mockResolvedValue(undefined) };

    return {
      service: new AgentAuthService(
        prisma as never,
        config as never,
        phones as never,
        otpTokens as never,
        sessions as never,
        sms,
      ),
      prisma,
      sms,
    };
  }

  it('does not send an OTP or expose account existence for an unknown phone', async () => {
    const { service, prisma, sms } = createService();
    prisma.agent.findUnique.mockResolvedValue(null);

    const result = await service.requestLoginOtp('024 123 4567');

    expect(sms.send).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ phoneMask: phone.mask }));
    expect(result).not.toHaveProperty('developmentCode');
  });

  it('sends an OTP for an existing agent without returning it in the response', async () => {
    const { service, prisma, sms } = createService();
    prisma.agent.findUnique.mockResolvedValue({ id: 'agent-id' });
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: 'challenge-id' });

    const result = await service.requestLoginOtp('024 123 4567');

    expect(sms.send).toHaveBeenCalledWith('+233241234567', '123456');
    expect(result).toEqual(expect.objectContaining({ phoneMask: phone.mask }));
    expect(result).not.toHaveProperty('developmentCode');
  });
});
