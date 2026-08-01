import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class InventoryVoucherEntryRequest {
  @IsString()
  @MaxLength(128)
  serialNumber!: string;

  @IsString()
  @MaxLength(64)
  pin!: string;
}

export class PreviewInventoryImportRequest {
  @IsUUID('4')
  productId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryVoucherEntryRequest)
  entries!: InventoryVoucherEntryRequest[];
}
