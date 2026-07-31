import { IsString, Length, Matches } from 'class-validator';

export class PasskeyRegistrationOptionsRequest {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  enrollmentToken!: string;

  @IsString()
  @Length(1, 80)
  @Matches(/\S/, { message: 'credentialName must not be blank' })
  credentialName!: string;
}
