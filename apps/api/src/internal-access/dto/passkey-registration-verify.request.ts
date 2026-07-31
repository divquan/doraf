import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { IsObject, IsUUID } from 'class-validator';

export class PasskeyRegistrationVerifyRequest {
  @IsUUID('4')
  ceremonyId!: string;

  @IsObject()
  response!: RegistrationResponseJSON;
}
