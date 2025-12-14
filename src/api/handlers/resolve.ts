/**
 * GET /api/resolve
 * Resolves neighborhood/zip/city text to a geo_unit
 */

import { sql, ilike, eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../../db';
import { placeAlias, geoUnit, sourceDoc } from '../../db/schema';
import type { ResolveResponse, ResolvedPlace, ResolutionConfidence } from '../../types/api';
import type { ResolveQueryInput } from '../../lib/validation';

/**
 * Determine confidence level based on match quality
 */
function determineConfidence(
  results: ResolvedPlace[],
  query: string
): ResolutionConfidence {
  if (results.length === 0) {
    return 'low';
  }

  const topResult = results[0];

  // Exact match on preferred alias = high confidence
  if (
    topResult.isPreferred &&
    topResult.matchedAlias.toLowerCase() === query.toLowerCase()
  ) {
    return 'high';
  }

  // Exact match on any alias = medium-high
  if (topResult.matchedAlias.toLowerCase() === query.toLowerCase()) {
    return 'high';
  }

  // Multiple results with similar scores = medium
  if (results.length > 1) {
    return 'medium';
  }

  // Fuzzy match = medium
  return 'medium';
}

/**
 * Format display name with context
 */
function formatDisplayName(name: string, stateCode: string, geoType: string): string {
  if (geoType === 'state') {
    return name;
  }
  return `${name}, ${stateCode}`;
}

export async function resolveHandler(
  input: ResolveQueryInput
): Promise<ResolveResponse> {
  const { q, state, city } = input;

  // Build query conditions
  const conditions = [];

  // Case-insensitive search on alias text
  // Using ILIKE for PostgreSQL case-insensitive matching
  conditions.push(
    sql`${placeAlias.aliasText} ILIKE ${`%${q}%`}`
  );

  // Optional state filter
  if (state) {
    conditions.push(eq(placeAlias.stateCode, state.toUpperCase()));
  }

  // Query with joins
  const rawResults = await db
    .select({
      geoUnitId: geoUnit.geoUnitId,
      geoUnitType: geoUnit.geoUnitType,
      geoid: geoUnit.geoid,
      name: geoUnit.name,
      stateCode: geoUnit.stateCode,
      countyFips: geoUnit.countyFips,
      aliasText: placeAlias.aliasText,
      aliasKind: placeAlias.aliasKind,
      aliasRank: placeAlias.aliasRank,
      isPreferred: placeAlias.isPreferred,
    })
    .from(placeAlias)
    .innerJoin(geoUnit, eq(placeAlias.geoUnitId, geoUnit.geoUnitId))
    .where(and(...conditions))
    .orderBy(
      // Prefer exact matches
      sql`CASE WHEN ${placeAlias.aliasText} ILIKE ${q} THEN 0 ELSE 1 END`,
      // Prefer matches in specified state
      state
        ? sql`CASE WHEN ${placeAlias.stateCode} = ${state.toUpperCase()} THEN 0 ELSE 1 END`
        : sql`1`,
      // Prefer preferred aliases
      desc(placeAlias.isPreferred),
      // Then by rank
      desc(placeAlias.aliasRank),
      // Finally alphabetical
      asc(geoUnit.name)
    )
    .limit(10);

  // Transform to API response format
  const results: ResolvedPlace[] = rawResults.map((row) => ({
    geoUnitId: row.geoUnitId,
    geoUnitType: row.geoUnitType,
    name: row.name,
    displayName: formatDisplayName(row.name, row.stateCode, row.geoUnitType),
    stateCode: row.stateCode,
    countyFips: row.countyFips,
    matchedAlias: row.aliasText,
    aliasKind: row.aliasKind,
    isPreferred: row.isPreferred,
  }));

  // Deduplicate by geoUnitId (keep first/best match)
  const uniqueResults = results.filter(
    (result, index, self) =>
      index === self.findIndex((r) => r.geoUnitId === result.geoUnitId)
  );

  const confidence = determineConfidence(uniqueResults, q);

  // Get bbox and centroid for top result
  let bbox = null;
  let centroid = null;

  if (uniqueResults.length > 0) {
    const topGeoUnitId = uniqueResults[0].geoUnitId;

    // Query PostGIS for geometry info
    const geoResult = await db.execute(sql`
      SELECT
        ST_XMin(ST_Envelope(geom)) as min_lng,
        ST_YMin(ST_Envelope(geom)) as min_lat,
        ST_XMax(ST_Envelope(geom)) as max_lng,
        ST_YMax(ST_Envelope(geom)) as max_lat,
        ST_X(centroid) as centroid_lng,
        ST_Y(centroid) as centroid_lat
      FROM geo_unit
      WHERE geo_unit_id = ${topGeoUnitId}
    `);

    if (geoResult.rows.length > 0) {
      const geo = geoResult.rows[0] as {
        min_lng: number;
        min_lat: number;
        max_lng: number;
        max_lat: number;
        centroid_lng: number;
        centroid_lat: number;
      };

      bbox = [geo.min_lng, geo.min_lat, geo.max_lng, geo.max_lat] as [
        number,
        number,
        number,
        number
      ];

      centroid = {
        type: 'Point' as const,
        coordinates: [geo.centroid_lng, geo.centroid_lat] as [number, number],
      };
    }
  }

  // Provide disambiguation if low confidence
  const disambiguation =
    confidence === 'low' || (confidence === 'medium' && uniqueResults.length > 1)
      ? uniqueResults.slice(0, 5)
      : null;

  return {
    query: q,
    confidence,
    results: uniqueResults.slice(0, 8),
    bbox,
    centroid,
    disambiguation,
  };
}
