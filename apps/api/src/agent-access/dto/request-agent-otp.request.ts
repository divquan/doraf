import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestAgentOtpRequest {
  @IsString()
  @MinLength(10)
  @MaxLength(24)
  phone!: string;
}
