import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class OutboxTaskDto {
  @IsUUID()
  eventId!: string;

  @IsUUID()
  claimToken!: string;

  @IsString()
  @IsNotEmpty()
  eventType!: string;
}
