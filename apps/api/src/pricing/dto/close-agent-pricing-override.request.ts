import { IsString, Length, Matches } from 'class-validator';

export class CloseAgentPricingOverrideRequest {
  @IsString() @Length(5, 500) @Matches(/\S/) reason!: string;
}
