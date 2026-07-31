import { IsString, IsUUID, MaxLength } from 'class-validator';

export class PreviewInventoryImportRequest {
  @IsUUID('4')
  productId!: string;

  @IsString()
  @MaxLength(1_000_000)
  csv!: string;
}
