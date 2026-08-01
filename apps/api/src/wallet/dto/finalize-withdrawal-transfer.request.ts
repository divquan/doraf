import { IsString, Matches } from 'class-validator';

export class FinalizeWithdrawalTransferRequest {
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
