import {
  IsDateString,
  IsInt,
  IsString,
  Length,
  Max,
  Matches,
  Min,
} from 'class-validator';

export class CreateProductPricingPolicyRequest {
  @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) basePriceMinor!: number;
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  maximumRetailPriceMinor!: number;
  @IsDateString() effectiveFrom!: string;
  @IsString() @Length(5, 500) @Matches(/\S/) reason!: string;
}
