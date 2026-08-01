import { IsString, Length, Matches } from 'class-validator';

export class ChangeAgentStatusRequest {
  @IsString()
  @Length(5, 500)
  @Matches(/\S/, { message: 'reason must not be blank' })
  reason!: string;
}
