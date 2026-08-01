import { IsInt, Max, Min } from 'class-validator';

export class SetAgentRetailPriceRequest {
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  retailPriceMinor!: number;
}
