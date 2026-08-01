import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client';

export class ChangeProductStatusRequest {
  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @IsString()
  @Length(5, 500)
  @Matches(/\S/, { message: 'reason must not be blank' })
  reason!: string;
}
