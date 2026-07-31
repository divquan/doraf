import { CsvInventoryParser } from './csv-inventory.parser';

describe('CsvInventoryParser', () => {
  const parser = new CsvInventoryParser();

  it('preserves a leading-zero PIN', () => {
    const result = parser.parse('serial_number,pin\nABC123,012345678912\n');

    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.pin).toBe('012345678912');
  });

  it('returns row-level errors and detects case-insensitive serial duplicates', () => {
    const result = parser.parse(
      'serial_number,pin\nABC123,012345678912\nabc123,123\n',
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          code: 'DUPLICATE_SERIAL_IN_FILE',
        }),
        expect.objectContaining({ rowNumber: 3, code: 'INVALID_PIN' }),
      ]),
    );
  });

  it('requires the stable two-column header', () => {
    const result = parser.parse('serial,pin\nABC123,012345678912\n');

    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'INVALID_HEADER' }),
    ]);
  });
});
