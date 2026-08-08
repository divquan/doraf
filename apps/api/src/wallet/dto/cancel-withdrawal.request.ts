import { IsOptional, IsString, Length } from 'class-validator';

export class CancelWithdrawalRequest {
  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
