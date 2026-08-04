import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateStorefrontRequest {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must be 3-30 lowercase alphanumeric characters with single hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  themePreset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  announcement?: string;
}
