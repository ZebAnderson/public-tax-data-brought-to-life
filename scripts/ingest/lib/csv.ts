import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export async function readCsvRecords<T extends Record<string, string>>(
  filePath: string
): Promise<T[]> {
  const raw = await readFile(filePath, 'utf8');
  const records = parse(raw, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
  return records;
}

