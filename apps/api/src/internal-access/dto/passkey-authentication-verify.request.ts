import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { IsObject, IsUUID } from 'class-validator';

export class PasskeyAuthenticationVerifyRequest {
  @IsUUID('4')
  ceremonyId!: string;

  @IsObject()
  response!: AuthenticationResponseJSON;
}
