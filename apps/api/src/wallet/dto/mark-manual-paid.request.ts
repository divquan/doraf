import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class MarkManualPaidRequest {
  @IsString()
  @Length(3, 200)
  @Matches(/\S/, {
    message: 'Transaction reference must contain a non-whitespace character',
  })
  reference!: string;

  @Matches(/^\d+$/, {
    message: 'Confirmed amount must be a whole number of pesewas',
  })
  confirmedNetAmountMinor!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
