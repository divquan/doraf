import { IsInt, Min } from 'class-validator';

export class SetAgentRetailPriceRequest {
  @IsInt()
  @Min(0)
  retailPriceMinor!: number;
}
