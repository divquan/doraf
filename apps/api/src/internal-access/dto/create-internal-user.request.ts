import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { InternalRole } from '../../generated/prisma/client';

export class CreateInternalUserRequest {
  @IsString()
  @Length(1, 120)
  @Matches(/\S/, { message: 'displayName must not be blank' })
  displayName!: string;

  @IsEnum(InternalRole)
  role!: InternalRole;

  @IsString()
  @Length(5, 500)
  @Matches(/\S/, { message: 'reason must not be blank' })
  reason!: string;
}
