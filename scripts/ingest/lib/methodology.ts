import type { DbClient } from './db.js';

export type DataKind = 'fact' | 'estimate' | 'signal';

export interface EnsureMethodologyVersionInput {
  name: string;
  version: string;
  kind: DataKind;
  description?: string;
}

export async function ensureMethodologyVersion(
  client: DbClient,
  input: EnsureMethodologyVersionInput
): Promise<string> {
  const result = await client.query<{ methodology_version_id: string }>(
    `
    INSERT INTO methodology_version (name, version, kind, description)
    VALUES ($1, $2, $3::taxatlas_data_kind, $4)
    ON CONFLICT (name, version)
    DO UPDATE SET
      kind = EXCLUDED.kind,
      description = COALESCE(EXCLUDED.description, methodology_version.description)
    RETURNING methodology_version_id
    `,
    [input.name, input.version, input.kind, input.description ?? null]
  );
  return result.rows[0].methodology_version_id;
}

