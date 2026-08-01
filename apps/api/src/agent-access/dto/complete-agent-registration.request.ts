import { IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteAgentRegistrationRequest {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  registrationToken!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
