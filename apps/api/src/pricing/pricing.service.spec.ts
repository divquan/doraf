import { BadRequestException } from '@nestjs/common';
import { clampRetailPrice } from './pricing.service';

describe('clampRetailPrice', () => {
  it('moves a price below the range to the effective base price', () => {
    expect(clampRetailPrice(1_900n, 2_000n, 3_000n)).toBe(2_000n);
  });

  it('moves a price above the range to the effective maximum', () => {
    expect(clampRetailPrice(3_100n, 2_000n, 3_000n)).toBe(3_000n);
  });

  it('leaves a price already inside the range unchanged', () => {
    expect(clampRetailPrice(2_500n, 2_000n, 3_000n)).toBe(2_500n);
  });

  it('rejects an invalid effective range', () => {
    expect(() => clampRetailPrice(2_500n, 3_000n, 2_000n)).toThrow(
      BadRequestException,
    );
  });
});
