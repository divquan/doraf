import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateWebOrderRequest {
  @IsUUID('4')
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  quantity!: number;

  @IsString()
  @Length(9, 24)
  deliveryPhone!: string;

  @IsString()
  @Length(9, 24)
  deliveryPhoneConfirmation!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  deliveryEmail?: string;

  @ValidateIf((request: CreateWebOrderRequest) =>
    Boolean(request.deliveryEmail),
  )
  @IsEmail()
  @MaxLength(254)
  deliveryEmailConfirmation?: string;
}
