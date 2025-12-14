/**
 * Pipeline C) Jurisdictions + geo_unit_jurisdiction overlay
 *
 * - Seeds pilot jurisdictions (state/county/city/school/special) from GeoJSON
 * - Upserts jurisdiction rows (including boundary geom)
 * - Computes geo_unit_jurisdiction coverage_ratio via spatial intersection
 */

import { createPool, withClient, withTransaction } from './lib/db.js';
import { fileExists } from './lib/files.js';
import { log } from './lib/logger.js';
import { ensureMethodologyVersion } from './lib/methodology.js';
import { getPilotConfig } from './lib/pilots.js';
import { repoFileUrl } from './lib/urls.js';
import { readJsonFile, upsertSourceDocFromFile, upsertSourceDocFromText } from './lib/source-doc.js';
import { upsertJurisdiction, type JurisdictionType } from './lib/upserts.js';

type JurisdictionFeatureProps = {
  jurisdiction_type: JurisdictionType;
  name: string;
  state_code?: string;
  external_id: string;
  parent_external_id?: string | null;
};

type JurisdictionFeature = {
  type: 'Feature';
  properties: JurisdictionFeatureProps;
  geometry: any;
};

type JurisdictionGeoJson = {
  type: 'FeatureCollection';
  features: JurisdictionFeature[];
};

async function main(): Promise<void> {
  const pilot = getPilotConfig();
  const filePath = pilot.paths.jurisdictionsGeoJson;
  log.info(`Starting jurisdictions ingest`, { pilot: pilot.pilotId, filePath });

  if (!(await fileExists(filePath))) {
    throw new Error(`Missing jurisdiction seed file: ${filePath}`);
  }

  const pool = createPool();
  await withClient(pool, async (client) => {
    await withTransaction(client, async () => {
      const { sourceDocId, contentSha256 } = await upsertSourceDocFromFile(
        client,
        filePath,
        repoFileUrl(filePath),
        {
          isDemo: true,
          title: `TaxAtlas pilot jurisdiction boundaries (${pilot.pilotId})`,
          mimeType: 'application/geo+json',
        }
      );

      const overlayMethodologyVersionId = await ensureMethodologyVersion(client, {
        ...pilot.methodologies.geoOverlay,
        description: 'Spatial overlay: coverage_ratio = area(intersection)/area(geo_unit)',
      });

      const geojson = await readJsonFile<JurisdictionGeoJson>(filePath);
      if (geojson.type !== 'FeatureCollection') {
        throw new Error(`Expected FeatureCollection in ${filePath}`);
      }

      // First pass: insert/update all jurisdictions without parents.
      const byExternalId = new Map<string, string>();
      for (const feature of geojson.features) {
        const props = feature.properties;
        if (!props?.jurisdiction_type || !props.name || !props.external_id) {
          throw new Error(`Invalid jurisdiction feature (missing required props) in ${filePath}`);
        }

        const jurisdictionId = await upsertJurisdiction(client, {
          jurisdictionType: props.jurisdiction_type,
          name: props.name,
          stateCode: (props.state_code ?? pilot.stateCode).toUpperCase(),
          externalId: props.external_id,
          parentJurisdictionId: null,
          geomGeoJson: feature.geometry,
          geomSrid: 4326,
          sourceDocId,
        });

        byExternalId.set(props.external_id, jurisdictionId);
      }

      // Second pass: apply parent relationships.
      for (const feature of geojson.features) {
        const props = feature.properties;
        const parentExternalId = props.parent_external_id?.trim();
        if (!parentExternalId) continue;

        const childId = byExternalId.get(props.external_id);
        const parentId = byExternalId.get(parentExternalId);
        if (!childId || !parentId) {
          throw new Error(
            `Parent relationship could not be resolved: child=${props.external_id} parent=${parentExternalId}`
          );
        }

        await upsertJurisdiction(client, {
          jurisdictionType: props.jurisdiction_type,
          name: props.name,
          stateCode: (props.state_code ?? pilot.stateCode).toUpperCase(),
          externalId: props.external_id,
          parentJurisdictionId: parentId,
          geomGeoJson: feature.geometry,
          geomSrid: 4326,
          sourceDocId,
        });
      }

      const overlayDocText = JSON.stringify(
        {
          pipeline: 'geo_unit_jurisdiction_overlay_v1',
          pilot: pilot.pilotId,
          jurisdiction_boundaries: {
            url: repoFileUrl(filePath),
            sha256: contentSha256,
          },
          formula:
            'coverage_ratio = area(intersection(geo_unit.geom, jurisdiction.geom)) / area(geo_unit.geom) (geography meters^2)',
        },
        null,
        2
      );

      const { sourceDocId: overlaySourceDocId } = await upsertSourceDocFromText(
        client,
        'taxatlas://pipeline/geo_unit_jurisdiction_overlay_v1',
        overlayDocText,
        {
          isDemo: true,
          title: `TaxAtlas spatial overlay (geo_unit_jurisdiction)`,
          mimeType: 'application/json',
        }
      );

      // Compute overlay mappings in-database (fast, uses GiST indexes).
      const overlayResult = await client.query(
        `
        INSERT INTO geo_unit_jurisdiction (
          geo_unit_id,
          jurisdiction_id,
          methodology_version_id,
          coverage_ratio,
          coverage_area_m2,
          notes,
          source_doc_id
        )
        SELECT
          gu.geo_unit_id,
          j.jurisdiction_id,
          $1::uuid AS methodology_version_id,
          (ST_Area(ST_Intersection(gu.geom, j.geom)::geography) / NULLIF(ST_Area(gu.geom::geography), 0))::numeric(7,6) AS coverage_ratio,
          ST_Area(ST_Intersection(gu.geom, j.geom)::geography) AS coverage_area_m2,
          'spatial overlay v1' AS notes,
          $2::uuid AS source_doc_id
        FROM geo_unit gu
        JOIN jurisdiction j
          ON j.geom IS NOT NULL
         AND gu.state_code = j.state_code
         AND ST_Intersects(gu.geom, j.geom)
        WHERE gu.state_code = $3
          AND gu.geo_unit_type IN ('tract','block_group','zip','neighborhood','city','custom')
        ON CONFLICT (geo_unit_id, jurisdiction_id, methodology_version_id)
        DO UPDATE SET
          coverage_ratio = EXCLUDED.coverage_ratio,
          coverage_area_m2 = EXCLUDED.coverage_area_m2,
          notes = EXCLUDED.notes,
          source_doc_id = EXCLUDED.source_doc_id
        `,
        [overlayMethodologyVersionId, overlaySourceDocId, pilot.stateCode]
      );

      log.info(`Jurisdictions ingest complete`, {
        jurisdictions: byExternalId.size,
        geoUnitJurisdictionUpserts: overlayResult.rowCount,
      });
    });
  });

  await pool.end();
}

main().catch((err) => {
  log.error('Jurisdictions ingest failed', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});

