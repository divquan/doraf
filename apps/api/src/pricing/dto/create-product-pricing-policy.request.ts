import {
  IsDateString,
  IsInt,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateProductPricingPolicyRequest {
  @IsInt() @Min(0) basePriceMinor!: number;
  @IsInt() @Min(0) maximumRetailPriceMinor!: number;
  @IsDateString() effectiveFrom!: string;
  @IsString() @Length(5, 500) @Matches(/\S/) reason!: string;
}
