/**
 * Pipeline A) Geographies
 *
 * - Downloads TIGER/Line shapefiles for tracts + block groups (pilot state)
 * - Filters to the pilot county
 * - Upserts geo_unit rows with PostGIS geometries
 * - Loads pilot "custom" geo units (city/neighborhood/zip) from GeoJSON stubs
 */

import path from 'node:path';
import { createPool, withClient, withTransaction } from './lib/db.js';
import { ensureDownloaded } from './lib/download.js';
import { ensureUnzipped, findShapefilePaths, iterShapefileFeatures } from './lib/shapefile.js';
import { fileExists } from './lib/files.js';
import { log } from './lib/logger.js';
import { getPilotConfig } from './lib/pilots.js';
import { repoFileUrl } from './lib/urls.js';
import { readJsonFile, upsertSourceDocFromFile } from './lib/source-doc.js';
import { upsertGeoUnit, type GeoUnitType } from './lib/upserts.js';
import { stateCodeFromFips } from './lib/us.js';

type GeoJsonFeature = {
  type: 'Feature';
  properties?: Record<string, any>;
  geometry: any;
};

type GeoJson = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

function getProp(props: Record<string, any> | undefined, keys: string[]): string | null {
  if (!props) return null;
  for (const k of keys) {
    const v = props[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return null;
}

async function ingestTigerGeoUnits(params: {
  url: string;
  year: number;
  stateFips: string;
  countyFips: string;
  geoUnitType: GeoUnitType;
  nameLabel: string;
}): Promise<void> {
  const cacheDir = path.join('data', 'cache', 'tiger', String(params.year), params.nameLabel);
  const zipPath = path.join(cacheDir, path.basename(params.url));
  const unzipDir = path.join(cacheDir, 'unzipped');

  const downloadResult = await ensureDownloaded(params.url, zipPath);
  if (downloadResult) {
    log.info(`Downloaded ${params.nameLabel}`, { bytes: downloadResult.bytes, sha256: downloadResult.sha256 });
  } else {
    log.info(`Using cached ${params.nameLabel}`, { zipPath });
  }

  await ensureUnzipped(zipPath, unzipDir);
  const { shpPath, dbfPath } = await findShapefilePaths(unzipDir);

  const pool = createPool();
  await withClient(pool, async (client) => {
    await withTransaction(client, async () => {
      const { sourceDocId } = await upsertSourceDocFromFile(client, zipPath, params.url, {
        isDemo: false,
        title: `US Census TIGER/Line ${params.year} ${params.nameLabel} (${params.stateFips})`,
        mimeType: 'application/zip',
        retrievedAt: new Date().toISOString(),
      });

      let processed = 0;
      let upserted = 0;

      for await (const feature of iterShapefileFeatures(shpPath, dbfPath)) {
        const props = feature?.properties as Record<string, any> | undefined;
        const geometry = feature?.geometry;
        if (!geometry) continue;

        const stateFips = getProp(props, ['STATEFP', 'STATEFP20', 'STATEFP10']);
        const countyFips = getProp(props, ['COUNTYFP', 'COUNTYFP20', 'COUNTYFP10']);
        if (stateFips !== params.stateFips) continue;
        if (countyFips !== params.countyFips) continue;

        const geoid = getProp(props, ['GEOID', 'GEOID20', 'GEOID10']);
        if (!geoid) continue;

        const name =
          getProp(props, ['NAMELSAD', 'NAMELSAD20', 'NAMELSAD10']) ??
          getProp(props, ['NAME', 'NAME20', 'NAME10']) ??
          `${params.geoUnitType} ${geoid}`;

        const stateCode = stateCodeFromFips(stateFips);

        await upsertGeoUnit(client, {
          geoUnitType: params.geoUnitType,
          geoid,
          name,
          stateCode,
          stateFips,
          countyFips,
          geomGeoJson: geometry,
          geomSrid: 4269, // TIGER/Line is NAD83
          sourceDocId,
        });

        processed += 1;
        upserted += 1;

        if (processed % 500 === 0) {
          log.info(`Ingested ${params.nameLabel}...`, { processed });
        }
      }

      log.info(`Done ingesting ${params.nameLabel}`, { processed, upserted });
    });
  });

  await pool.end();
}

async function ingestCustomGeoUnits(pilot: ReturnType<typeof getPilotConfig>): Promise<void> {
  const filePath = pilot.paths.customGeoUnitsGeoJson;
  const exists = await fileExists(filePath);
  if (!exists) {
    log.warn(`No custom geo units GeoJSON found; skipping`, { filePath });
    return;
  }

  const geojson = await readJsonFile<GeoJson>(filePath);
  if (geojson.type !== 'FeatureCollection') {
    throw new Error(`Expected FeatureCollection in ${filePath}`);
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
          title: `TaxAtlas pilot custom geo units (${pilot.pilotId})`,
          mimeType: 'application/geo+json',
        }
      );

      let processed = 0;
      for (const feature of geojson.features) {
        const props = feature.properties ?? {};
        const geoUnitType = String(props.geo_unit_type ?? '').trim() as GeoUnitType;
        const geoid = String(props.geoid ?? '').trim();
        const name = String(props.name ?? '').trim();
        if (!geoUnitType || !geoid || !name) {
          throw new Error(`Invalid custom geo unit feature (missing geo_unit_type/geoid/name) in ${filePath}`);
        }

        await upsertGeoUnit(client, {
          geoUnitType,
          geoid,
          name,
          stateCode: pilot.stateCode,
          stateFips: pilot.stateFips,
          countyFips: props.county_fips ? String(props.county_fips) : null,
          geomGeoJson: feature.geometry,
          geomSrid: 4326,
          sourceDocId,
        });

        processed += 1;
      }

      log.info(`Done ingesting custom geo units`, { processed });
    });
  });

  await pool.end();
}

async function main(): Promise<void> {
  const pilot = getPilotConfig();
  log.info(`Starting geos ingest`, { pilot: pilot.pilotId });

  await ingestTigerGeoUnits({
    url: pilot.tiger.tractsUrl,
    year: pilot.tigerYear,
    stateFips: pilot.stateFips,
    countyFips: pilot.countyFips,
    geoUnitType: 'tract',
    nameLabel: 'tracts',
  });

  await ingestTigerGeoUnits({
    url: pilot.tiger.blockGroupsUrl,
    year: pilot.tigerYear,
    stateFips: pilot.stateFips,
    countyFips: pilot.countyFips,
    geoUnitType: 'block_group',
    nameLabel: 'block_groups',
  });

  await ingestCustomGeoUnits(pilot);

  log.info(`Geos ingest complete`, { pilot: pilot.pilotId });
}

main().catch((err) => {
  log.error('Geos ingest failed', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});

