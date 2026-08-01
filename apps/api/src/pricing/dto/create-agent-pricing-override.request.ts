import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateAgentPricingOverrideRequest {
  @IsOptional() @IsInt() @Min(0) basePriceMinor?: number;
  @IsOptional() @IsInt() @Min(0) maximumRetailPriceMinor?: number;
  @IsDateString() effectiveFrom!: string;
  @IsString() @Length(5, 500) @Matches(/\S/) reason!: string;
}
