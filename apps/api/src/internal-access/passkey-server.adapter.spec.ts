import { SimpleWebAuthnPasskeyServer } from './passkey-server.adapter';

describe('SimpleWebAuthnPasskeyServer', () => {
  it('requires a discoverable credential and user verification', async () => {
    const adapter = new SimpleWebAuthnPasskeyServer();
    const options = await adapter.registrationOptions({
      relyingPartyName: 'Doraf Administration',
      relyingPartyId: 'localhost',
      userId: Uint8Array.from(Buffer.alloc(16, 1)),
      userName: 'internal-user',
      userDisplayName: 'Internal User',
      excludeCredentials: [],
      timeoutMs: 300_000,
    });

    expect(options.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    });
  });

  it('requires user verification for usernameless authentication', async () => {
    const adapter = new SimpleWebAuthnPasskeyServer();
    const options = await adapter.authenticationOptions({
      relyingPartyId: 'localhost',
      timeoutMs: 300_000,
    });

    expect(options.userVerification).toBe('required');
    expect(options.allowCredentials).toBeUndefined();
  });
});
