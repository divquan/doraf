import { Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
  WebAuthnCredential,
} from '@simplewebauthn/server';

export const PASSKEY_SERVER = Symbol('PASSKEY_SERVER');

export interface PasskeyServer {
  registrationOptions(input: {
    relyingPartyName: string;
    relyingPartyId: string;
    userId: Uint8Array<ArrayBuffer>;
    userName: string;
    userDisplayName: string;
    excludeCredentials: Array<{
      id: string;
      transports?: AuthenticatorTransportFuture[];
    }>;
    timeoutMs: number;
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration(input: {
    response: RegistrationResponseJSON;
    challenge: string;
    origin: string;
    relyingPartyId: string;
  }): Promise<VerifiedRegistrationResponse>;
  authenticationOptions(input: {
    relyingPartyId: string;
    timeoutMs: number;
  }): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyAuthentication(input: {
    response: AuthenticationResponseJSON;
    challenge: string;
    origin: string;
    relyingPartyId: string;
    credential: WebAuthnCredential;
  }): Promise<VerifiedAuthenticationResponse>;
}

@Injectable()
export class SimpleWebAuthnPasskeyServer implements PasskeyServer {
  registrationOptions(
    input: Parameters<PasskeyServer['registrationOptions']>[0],
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions({
      rpName: input.relyingPartyName,
      rpID: input.relyingPartyId,
      userID: input.userId,
      userName: input.userName,
      userDisplayName: input.userDisplayName,
      timeout: input.timeoutMs,
      attestationType: 'none',
      excludeCredentials: input.excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
    });
  }

  verifyRegistration(
    input: Parameters<PasskeyServer['verifyRegistration']>[0],
  ): Promise<VerifiedRegistrationResponse> {
    return verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: input.challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.relyingPartyId,
      requireUserVerification: true,
    });
  }

  authenticationOptions(
    input: Parameters<PasskeyServer['authenticationOptions']>[0],
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({
      rpID: input.relyingPartyId,
      timeout: input.timeoutMs,
      userVerification: 'required',
    });
  }

  verifyAuthentication(
    input: Parameters<PasskeyServer['verifyAuthentication']>[0],
  ): Promise<VerifiedAuthenticationResponse> {
    return verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: input.challenge,
      expectedOrigin: input.origin,
      expectedRPID: input.relyingPartyId,
      credential: input.credential,
      requireUserVerification: true,
    });
  }
}
