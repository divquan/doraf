import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyAgentOtpRequest {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
