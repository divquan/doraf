import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { WithdrawalPayoutMethod } from '../../generated/prisma/client';

export class WithdrawalDecisionRequest {
  @IsString()
  @Length(3, 500)
  reason!: string;

  @IsOptional()
  @IsEnum(WithdrawalPayoutMethod)
  payoutMethod?: WithdrawalPayoutMethod;
}
