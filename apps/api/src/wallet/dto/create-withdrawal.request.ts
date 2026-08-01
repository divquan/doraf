import { IsIn, IsString, Length, Matches } from 'class-validator';

export class CreateWithdrawalRequest {
  @IsString()
  @Matches(/^\d+$/)
  netAmountMinor!: string;

  @IsString()
  @IsIn(['MTN', 'TELECEL', 'AIRTELTIGO'])
  network!: string;

  @IsString()
  @Length(43, 43)
  withdrawalToken!: string;
}
