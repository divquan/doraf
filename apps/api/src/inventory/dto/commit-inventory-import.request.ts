import {
  IsDateString,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CommitInventoryImportRequest {
  @IsUUID('4')
  productId!: string;

  @IsString()
  @Length(1, 160)
  @Matches(/\S/, { message: 'vendorName must not be blank' })
  vendorName!: string;

  @IsString()
  @Length(1, 160)
  @Matches(/\S/, { message: 'vendorReference must not be blank' })
  vendorReference!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'acquisitionDate must use YYYY-MM-DD',
  })
  acquisitionDate!: string;

  @MaxLength(18)
  @Matches(/^\d+$/, {
    message: 'unitAcquisitionCostMinor must be a non-negative integer string',
  })
  unitAcquisitionCostMinor!: string;

  @IsString()
  @Length(5, 500)
  @Matches(/\S/, { message: 'reason must not be blank' })
  reason!: string;

  @IsString()
  @MaxLength(1_000_000)
  csv!: string;
}
