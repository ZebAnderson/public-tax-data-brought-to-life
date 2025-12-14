import { v5 as uuidv5 } from 'uuid';

// A stable namespace UUID for TaxAtlas ingestion IDs (generated once).
// You can rotate this only if you are OK changing deterministic IDs.
export const TAXATLAS_INGEST_NAMESPACE = '8b7b1f4f-3d36-4d8a-8a5f-0b3e3f0efc12';

export function stableUuid(parts: Array<string | number | null | undefined>): string {
  const normalized = parts
    .map((p) => (p === null || p === undefined ? '' : String(p).trim()))
    .join('|');
  return uuidv5(normalized, TAXATLAS_INGEST_NAMESPACE);
}

