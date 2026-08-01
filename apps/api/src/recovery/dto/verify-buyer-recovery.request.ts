import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyBuyerRecoveryRequest {
  @IsUUID('4')
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
