/**
 * GET /api/place/:geoUnitId/pending
 * Returns proposed budgets, introduced bills, referendums (policy_signal)
 */

import { sql, eq, and, inArray } from 'drizzle-orm';
import { db, getCurrentMethodologyVersionId } from '../../db';
import { geoUnit, sourceDoc, policySignal, jurisdiction, taxInstrument } from '../../db/schema';
import type { PendingResponse, PolicySignalDetail, SourceReference } from '../../types/api';
import type { GeoUnitIdParam } from '../../lib/validation';
import type { TaxType, PolicySignalStatus } from '../../types/database';

// Disclaimer text for pending items - MUST be shown prominently
const PENDING_DISCLAIMER =
  'Items below are proposals, pending legislation, or ballot measures. They are NOT enacted law. Outcomes are uncertain. We make no predictions.';

/**
 * Map policy signal type to display type
 */
function mapSignalType(
  details: Record<string, unknown>
): PolicySignalDetail['details']['type'] {
  const type = details.type as string | undefined;

  switch (type) {
    case 'budget':
    case 'proposed_budget':
      return 'proposed_budget';
    case 'bill':
    case 'legislation':
    case 'pending_legislation':
      return 'pending_legislation';
    case 'ballot':
    case 'ballot_measure':
      return 'ballot_measure';
    case 'referendum':
      return 'referendum';
    default:
      return 'other';
  }
}

export async function pendingHandler(
  params: GeoUnitIdParam
): Promise<PendingResponse> {
  const { geoUnitId } = params;

  const methodologyVersionId = await getCurrentMethodologyVersionId();

  // Get geo_unit info
  const geoResult = await db
    .select({
      name: geoUnit.name,
      isDemo: sourceDoc.isDemo,
    })
    .from(geoUnit)
    .innerJoin(sourceDoc, eq(geoUnit.sourceDocId, sourceDoc.sourceDocId))
    .where(eq(geoUnit.geoUnitId, geoUnitId))
    .limit(1);

  if (geoResult.length === 0) {
    throw new Error(`GeoUnit not found: ${geoUnitId}`);
  }

  const { name, isDemo } = geoResult[0];

  // Get applicable jurisdiction IDs
  const jurisdictionIdsResult = await db.execute(sql`
    SELECT guj.jurisdiction_id
    FROM geo_unit_jurisdiction guj
    WHERE guj.geo_unit_id = ${geoUnitId}
      AND guj.methodology_version_id = ${methodologyVersionId}
      AND guj.coverage_ratio > 0
  `);

  const jurisdictionIds = (jurisdictionIdsResult.rows as Array<{ jurisdiction_id: string }>)
    .map((r) => r.jurisdiction_id);

  if (jurisdictionIds.length === 0) {
    return {
      geoUnitId,
      name,
      isDemo,
      lastChecked: new Date().toISOString(),
      items: [],
      disclaimer: PENDING_DISCLAIMER,
    };
  }

  // Get pending policy signals for these jurisdictions
  // Only include 'proposed' or 'pending' status
  const signalsResult = await db.execute(sql`
    SELECT
      ps.policy_signal_id,
      ps.status,
      ps.signal_date,
      ps.title,
      ps.summary,
      ps.tax_type,
      ps.tax_instrument_id,
      ps.details,
      j.jurisdiction_id,
      j.jurisdiction_type,
      j.name AS jurisdiction_name,
      ti.name AS instrument_name,
      sd.source_doc_id,
      sd.url,
      sd.title AS source_title,
      sd.retrieved_at,
      sd.published_at,
      sd.is_demo
    FROM policy_signal ps
    JOIN jurisdiction j ON j.jurisdiction_id = ps.jurisdiction_id
    JOIN source_doc sd ON sd.source_doc_id = ps.source_doc_id
    LEFT JOIN tax_instrument ti ON ti.tax_instrument_id = ps.tax_instrument_id
    WHERE ps.jurisdiction_id = ANY(${jurisdictionIds}::uuid[])
      AND ps.methodology_version_id = ${methodologyVersionId}
      AND ps.status IN ('proposed', 'pending')
    ORDER BY ps.signal_date DESC
  `);

  const items: PolicySignalDetail[] = (signalsResult.rows as Array<{
    policy_signal_id: string;
    status: PolicySignalStatus;
    signal_date: string;
    title: string;
    summary: string | null;
    tax_type: TaxType | null;
    tax_instrument_id: string | null;
    details: Record<string, unknown>;
    jurisdiction_id: string;
    jurisdiction_type: string;
    jurisdiction_name: string;
    instrument_name: string | null;
    source_doc_id: string;
    url: string;
    source_title: string | null;
    retrieved_at: Date | null;
    published_at: string | null;
    is_demo: boolean;
  }>).map((row) => ({
    policySignalId: row.policy_signal_id,
    status: row.status,
    signalDate: row.signal_date,
    title: row.title,
    summary: row.summary,
    jurisdictionId: row.jurisdiction_id,
    jurisdictionType: row.jurisdiction_type as PolicySignalDetail['jurisdictionType'],
    jurisdictionName: row.jurisdiction_name,
    taxType: row.tax_type,
    taxInstrumentId: row.tax_instrument_id,
    instrumentName: row.instrument_name,
    details: {
      type: mapSignalType(row.details),
      potentialImpact: row.details.potential_impact as string | undefined,
      deadline: row.details.deadline as string | undefined,
      phase: row.details.phase as string | undefined,
      billNumber: row.details.bill_number as string | undefined,
      electionDate: row.details.election_date as string | undefined,
    },
    dataType: 'signal' as const,
    source: {
      sourceId: row.source_doc_id,
      url: row.url,
      title: row.source_title,
      retrievedAt: row.retrieved_at?.toISOString() ?? null,
      publishedAt: row.published_at,
      isDemo: row.is_demo,
    },
  }));

  return {
    geoUnitId,
    name,
    isDemo,
    lastChecked: new Date().toISOString(),
    items,
    disclaimer: PENDING_DISCLAIMER,
  };
}
