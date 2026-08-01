import { IsString, Matches } from 'class-validator';

export class RequestBuyerRecoveryRequest {
  @IsString()
  @Matches(/^DRF-[a-f0-9]{24}$/i)
  orderReference!: string;
}
