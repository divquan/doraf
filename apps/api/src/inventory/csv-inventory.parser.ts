import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import type {
  InventoryValidationError,
  PlainVoucherRow,
} from './inventory.types';

export interface ParsedInventoryCsv {
  rows: PlainVoucherRow[];
  sourceRowCount: number;
  errors: InventoryValidationError[];
}

const expectedHeader = ['serial_number', 'pin'];
const serialPattern = /^[A-Za-z0-9]+$/;
const pinPattern = /^\d{12}$/;

@Injectable()
export class CsvInventoryParser {
  parse(csv: string): ParsedInventoryCsv {
    let records: string[][];

    try {
      records = parse(csv, {
        bom: true,
        skip_empty_lines: true,
      });
    } catch {
      return {
        rows: [],
        sourceRowCount: 0,
        errors: [
          {
            rowNumber: 1,
            field: 'csv',
            code: 'INVALID_CSV',
            message: 'The file is not valid CSV.',
          },
        ],
      };
    }

    const header = records[0]?.map((value) => value.trim());
    if (
      !header ||
      header.length !== expectedHeader.length ||
      header.some((value, index) => value !== expectedHeader[index])
    ) {
      return {
        rows: [],
        sourceRowCount: Math.max(records.length - 1, 0),
        errors: [
          {
            rowNumber: 1,
            field: 'csv',
            code: 'INVALID_HEADER',
            message: 'The CSV header must be exactly serial_number,pin.',
          },
        ],
      };
    }

    const errors: InventoryValidationError[] = [];
    const rows: PlainVoucherRow[] = [];
    const firstSerialRow = new Map<string, number>();
    const firstPinRow = new Map<string, number>();

    records.slice(1).forEach((record, index) => {
      const rowNumber = index + 2;
      const serialNumber = (record[0] ?? '').trim();
      const pin = (record[1] ?? '').trim();
      const row: PlainVoucherRow = { rowNumber, serialNumber, pin };
      rows.push(row);

      if (record.length !== expectedHeader.length) {
        errors.push({
          rowNumber,
          field: 'csv',
          code: 'INVALID_CSV',
          message: 'Each CSV row must contain exactly two columns.',
        });
      }

      if (!serialNumber) {
        errors.push({
          rowNumber,
          field: 'serial_number',
          code: 'MISSING_SERIAL',
          message: 'Serial number is required.',
        });
      } else if (
        serialNumber.length > 64 ||
        !serialPattern.test(serialNumber)
      ) {
        errors.push({
          rowNumber,
          field: 'serial_number',
          code: 'INVALID_SERIAL',
          message: 'Serial number must contain 1 to 64 letters and digits.',
        });
      } else {
        const normalizedSerial = normalizeSerial(serialNumber);
        const priorRow = firstSerialRow.get(normalizedSerial);
        if (priorRow !== undefined) {
          errors.push({
            rowNumber,
            field: 'serial_number',
            code: 'DUPLICATE_SERIAL_IN_FILE',
            message: `Serial number duplicates row ${priorRow}.`,
          });
        } else {
          firstSerialRow.set(normalizedSerial, rowNumber);
        }
      }

      if (!pin) {
        errors.push({
          rowNumber,
          field: 'pin',
          code: 'MISSING_PIN',
          message: 'PIN is required.',
        });
      } else if (!pinPattern.test(pin)) {
        errors.push({
          rowNumber,
          field: 'pin',
          code: 'INVALID_PIN',
          message: 'PIN must contain exactly 12 digits.',
        });
      } else {
        const priorRow = firstPinRow.get(pin);
        if (priorRow !== undefined) {
          errors.push({
            rowNumber,
            field: 'pin',
            code: 'DUPLICATE_PIN_IN_FILE',
            message: `PIN duplicates row ${priorRow}.`,
          });
        } else {
          firstPinRow.set(pin, rowNumber);
        }
      }
    });

    if (rows.length === 0) {
      errors.push({
        rowNumber: 2,
        field: 'csv',
        code: 'INVALID_CSV',
        message: 'The CSV must contain at least one voucher row.',
      });
    }

    return {
      rows,
      sourceRowCount: rows.length,
      errors,
    };
  }
}

export function normalizeSerial(serialNumber: string): string {
  return serialNumber.trim().toUpperCase();
}
