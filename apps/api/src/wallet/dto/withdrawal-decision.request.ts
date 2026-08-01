import { IsString, Length } from 'class-validator';

export class WithdrawalDecisionRequest {
  @IsString()
  @Length(3, 500)
  reason!: string;
}
