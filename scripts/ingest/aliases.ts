/**
 * Pipeline B) Place aliases
 *
 * Seeds user-searchable aliases (neighborhood names, ZIP codes, city name) into place_alias.
 * Uses idempotent upserts keyed by (alias_text, state_code, geo_unit_id, alias_kind).
 */

import { createPool, withClient, withTransaction } from './lib/db.js';
import { fileExists } from './lib/files.js';
import { log } from './lib/logger.js';
import { getPilotConfig } from './lib/pilots.js';
import { repoFileUrl } from './lib/urls.js';
import { readJsonFile, upsertSourceDocFromFile } from './lib/source-doc.js';
import { getGeoUnitId, type GeoUnitType } from './lib/upserts.js';

type AliasSeed = {
  state_code?: string;
  entries: Array<{
    geo_unit_type: GeoUnitType;
    geoid: string;
    alias_kind?: string;
    aliases: Array<
      | string
      | {
          text: string;
          rank?: number;
          preferred?: boolean;
        }
    >;
  }>;
};

async function upsertPlaceAlias(params: {
  client: any;
  aliasText: string;
  stateCode: string;
  geoUnitId: string;
  aliasKind: string;
  aliasRank: number;
  isPreferred: boolean;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO place_alias (
      alias_text,
      state_code,
      geo_unit_id,
      alias_kind,
      alias_rank,
      is_preferred,
      source_doc_id
    )
    VALUES ($1::citext, $2, $3::uuid, $4, $5, $6, $7::uuid)
    ON CONFLICT (alias_text, state_code, geo_unit_id, alias_kind)
    DO UPDATE SET
      alias_rank = EXCLUDED.alias_rank,
      is_preferred = EXCLUDED.is_preferred,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.aliasText,
      params.stateCode,
      params.geoUnitId,
      params.aliasKind,
      params.aliasRank,
      params.isPreferred,
      params.sourceDocId,
    ]
  );
}

async function main(): Promise<void> {
  const pilot = getPilotConfig();
  const filePath = pilot.paths.placeAliasesJson;
  log.info(`Starting aliases ingest`, { pilot: pilot.pilotId, filePath });

  if (!(await fileExists(filePath))) {
    throw new Error(`Missing alias seed file: ${filePath}`);
  }

  const pool = createPool();
  await withClient(pool, async (client) => {
    await withTransaction(client, async () => {
      const { sourceDocId } = await upsertSourceDocFromFile(
        client,
        filePath,
        repoFileUrl(filePath),
        {
          isDemo: true,
          title: `TaxAtlas pilot place aliases (${pilot.pilotId})`,
          mimeType: 'application/json',
        }
      );

      const seed = await readJsonFile<AliasSeed>(filePath);
      const stateCode = (seed.state_code ?? pilot.stateCode).toUpperCase();

      let processed = 0;
      for (const entry of seed.entries) {
        const geoUnitId = await getGeoUnitId(client, entry.geo_unit_type, entry.geoid);
        if (!geoUnitId) {
          throw new Error(
            `Alias references missing geo_unit: type=${entry.geo_unit_type} geoid=${entry.geoid}`
          );
        }

        const aliasKind = entry.alias_kind ?? 'name';
        for (const alias of entry.aliases) {
          const aliasText = typeof alias === 'string' ? alias : alias.text;
          const aliasRank = typeof alias === 'string' ? 0 : (alias.rank ?? 0);
          const isPreferred = typeof alias === 'string' ? false : (alias.preferred ?? false);

          await upsertPlaceAlias({
            client,
            aliasText,
            stateCode,
            geoUnitId,
            aliasKind,
            aliasRank,
            isPreferred,
            sourceDocId,
          });

          processed += 1;
        }
      }

      log.info(`Aliases ingest complete`, { processed });
    });
  });

  await pool.end();
}

main().catch((err) => {
  log.error('Aliases ingest failed', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});

