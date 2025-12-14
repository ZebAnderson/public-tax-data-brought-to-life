/**
 * GET /api/place/:geoUnitId/accountability
 * Returns decision timeline, impacts, roll-call votes, officials, and sources
 */

import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';
import { db, getCurrentMethodologyVersionId } from '../../db';
import { geoUnit, sourceDoc } from '../../db/schema';
import type {
  AccountabilityResponse,
  DecisionEventDetail,
  TaxImpactDetail,
  VoteRecordDetail,
  OfficialVote,
  OfficialAtEvent,
  SourceReference,
} from '../../types/api';
import type { GeoUnitIdParam, AccountabilityQueryInput } from '../../lib/validation';
import type { TaxType, DecisionEventType, ImpactDirection, VoteValue } from '../../types/database';

export async function accountabilityHandler(
  params: GeoUnitIdParam,
  query: AccountabilityQueryInput
): Promise<AccountabilityResponse> {
  const { geoUnitId } = params;
  const currentYear = new Date().getFullYear();
  const fromYear = query.from ?? currentYear - 10;
  const toYear = query.to ?? currentYear;
  const taxTypeFilter = query.taxType;

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

  // Build tax type filter
  const taxTypeCondition = taxTypeFilter
    ? sql`AND ti.tax_type = ${taxTypeFilter}`
    : sql``;

  // Complex query to get decision events with all related data
  const eventsResult = await db.execute(sql`
    WITH applicable_jurisdictions AS (
      SELECT guj.jurisdiction_id, guj.coverage_ratio
      FROM geo_unit_jurisdiction guj
      WHERE guj.geo_unit_id = ${geoUnitId}
        AND guj.methodology_version_id = ${methodologyVersionId}
        AND guj.coverage_ratio > 0
    ),
    applicable_instruments AS (
      SELECT ti.tax_instrument_id, ti.jurisdiction_id, ti.tax_type, ti.name
      FROM tax_instrument ti
      JOIN applicable_jurisdictions aj ON aj.jurisdiction_id = ti.jurisdiction_id
      WHERE ti.is_active = true
        ${taxTypeCondition}
    ),
    relevant_events AS (
      SELECT DISTINCT de.decision_event_id
      FROM decision_event de
      JOIN decision_tax_impact dti ON dti.decision_event_id = de.decision_event_id
      JOIN applicable_instruments ai ON ai.tax_instrument_id = dti.tax_instrument_id
      WHERE EXTRACT(YEAR FROM de.event_date) BETWEEN ${fromYear} AND ${toYear}
        AND dti.methodology_version_id = ${methodologyVersionId}
    )
    SELECT
      de.decision_event_id,
      de.event_type,
      de.event_date,
      de.effective_date,
      de.title,
      de.summary,
      j.jurisdiction_id,
      j.jurisdiction_type,
      j.name AS jurisdiction_name,
      sd.source_doc_id,
      sd.url,
      sd.title AS source_title,
      sd.retrieved_at,
      sd.published_at,
      sd.is_demo
    FROM relevant_events re
    JOIN decision_event de ON de.decision_event_id = re.decision_event_id
    JOIN jurisdiction j ON j.jurisdiction_id = de.jurisdiction_id
    JOIN source_doc sd ON sd.source_doc_id = de.source_doc_id
    ORDER BY de.event_date DESC
  `);

  const events: DecisionEventDetail[] = [];

  for (const row of eventsResult.rows as Array<{
    decision_event_id: string;
    event_type: DecisionEventType;
    event_date: string;
    effective_date: string | null;
    title: string;
    summary: string | null;
    jurisdiction_id: string;
    jurisdiction_type: string;
    jurisdiction_name: string;
    source_doc_id: string;
    url: string;
    source_title: string | null;
    retrieved_at: Date | null;
    published_at: string | null;
    is_demo: boolean;
  }>) {
    // Get tax impacts for this event
    const impactsResult = await db.execute(sql`
      SELECT
        dti.decision_tax_impact_id,
        dti.tax_instrument_id,
        ti.tax_type,
        ti.name AS instrument_name,
        dti.impact_direction,
        dti.tax_year,
        dti.delta_rate_value,
        dti.delta_revenue_amount,
        dti.delta_description,
        sd.source_doc_id,
        sd.url,
        sd.title,
        sd.retrieved_at,
        sd.published_at,
        sd.is_demo
      FROM decision_tax_impact dti
      JOIN tax_instrument ti ON ti.tax_instrument_id = dti.tax_instrument_id
      JOIN source_doc sd ON sd.source_doc_id = dti.source_doc_id
      WHERE dti.decision_event_id = ${row.decision_event_id}
        AND dti.methodology_version_id = ${methodologyVersionId}
    `);

    const impacts: TaxImpactDetail[] = (impactsResult.rows as Array<{
      decision_tax_impact_id: string;
      tax_instrument_id: string;
      tax_type: TaxType;
      instrument_name: string;
      impact_direction: ImpactDirection;
      tax_year: number | null;
      delta_rate_value: string | null;
      delta_revenue_amount: string | null;
      delta_description: string | null;
      source_doc_id: string;
      url: string;
      title: string | null;
      retrieved_at: Date | null;
      published_at: string | null;
      is_demo: boolean;
    }>).map((impact) => ({
      taxInstrumentId: impact.tax_instrument_id,
      taxType: impact.tax_type,
      instrumentName: impact.instrument_name,
      impactDirection: impact.impact_direction,
      taxYear: impact.tax_year,
      deltaRateValue: impact.delta_rate_value ? Number(impact.delta_rate_value) : null,
      deltaRevenueAmount: impact.delta_revenue_amount ? Number(impact.delta_revenue_amount) : null,
      deltaDescription: impact.delta_description,
      source: {
        sourceId: impact.source_doc_id,
        url: impact.url,
        title: impact.title,
        retrievedAt: impact.retrieved_at?.toISOString() ?? null,
        publishedAt: impact.published_at,
        isDemo: impact.is_demo,
      },
    }));

    // Get vote records for this event
    const votesResult = await db.execute(sql`
      SELECT
        vr.vote_record_id,
        vr.vote_type,
        vr.vote_date,
        vr.question,
        vr.passed,
        vr.yes_count,
        vr.no_count,
        vr.abstain_count,
        vr.absent_count,
        sd.source_doc_id,
        sd.url,
        sd.title,
        sd.retrieved_at,
        sd.published_at,
        sd.is_demo
      FROM vote_record vr
      JOIN source_doc sd ON sd.source_doc_id = vr.source_doc_id
      WHERE vr.decision_event_id = ${row.decision_event_id}
    `);

    const voteRecords: VoteRecordDetail[] = [];

    for (const vr of votesResult.rows as Array<{
      vote_record_id: string;
      vote_type: string;
      vote_date: string;
      question: string | null;
      passed: boolean | null;
      yes_count: number | null;
      no_count: number | null;
      abstain_count: number | null;
      absent_count: number | null;
      source_doc_id: string;
      url: string;
      title: string | null;
      retrieved_at: Date | null;
      published_at: string | null;
      is_demo: boolean;
    }>) {
      // Get individual votes
      const voteCastsResult = await db.execute(sql`
        SELECT
          vc.vote_value,
          vc.weight,
          p.person_id,
          p.full_name,
          o.office_id,
          o.office_name
        FROM vote_cast vc
        JOIN person p ON p.person_id = vc.voter_person_id
        LEFT JOIN term t ON t.person_id = p.person_id
          AND t.start_date <= ${vr.vote_date}::date
          AND (t.end_date IS NULL OR t.end_date >= ${vr.vote_date}::date)
        LEFT JOIN office o ON o.office_id = t.office_id
          AND o.jurisdiction_id = ${row.jurisdiction_id}
        WHERE vc.vote_record_id = ${vr.vote_record_id}
          AND vc.voter_person_id IS NOT NULL
      `);

      const votes: OfficialVote[] = (voteCastsResult.rows as Array<{
        vote_value: VoteValue;
        weight: string;
        person_id: string;
        full_name: string;
        office_id: string | null;
        office_name: string | null;
      }>).map((vote) => ({
        personId: vote.person_id,
        fullName: vote.full_name,
        officeId: vote.office_id ?? '',
        officeName: vote.office_name ?? 'Unknown Office',
        voteValue: vote.vote_value,
        weight: Number(vote.weight),
      }));

      voteRecords.push({
        voteRecordId: vr.vote_record_id,
        voteType: vr.vote_type as VoteRecordDetail['voteType'],
        voteDate: vr.vote_date,
        question: vr.question,
        passed: vr.passed,
        yesCount: vr.yes_count,
        noCount: vr.no_count,
        abstainCount: vr.abstain_count,
        absentCount: vr.absent_count,
        votes,
        source: {
          sourceId: vr.source_doc_id,
          url: vr.url,
          title: vr.title,
          retrievedAt: vr.retrieved_at?.toISOString() ?? null,
          publishedAt: vr.published_at,
          isDemo: vr.is_demo,
        },
      });
    }

    // Get officials in office at time of event
    const officialsResult = await db.execute(sql`
      SELECT DISTINCT
        p.person_id,
        p.full_name,
        o.office_id,
        o.office_name,
        t.start_date,
        t.end_date
      FROM office o
      JOIN term t ON t.office_id = o.office_id
      JOIN person p ON p.person_id = t.person_id
      WHERE o.jurisdiction_id = ${row.jurisdiction_id}
        AND t.start_date <= ${row.event_date}::date
        AND (t.end_date IS NULL OR t.end_date >= ${row.event_date}::date)
      ORDER BY o.office_name, p.full_name
    `);

    const officialsAtEvent: OfficialAtEvent[] = (officialsResult.rows as Array<{
      person_id: string;
      full_name: string;
      office_id: string;
      office_name: string;
      start_date: string;
      end_date: string | null;
    }>).map((official) => ({
      personId: official.person_id,
      fullName: official.full_name,
      officeId: official.office_id,
      officeName: official.office_name,
      termStart: official.start_date,
      termEnd: official.end_date,
    }));

    events.push({
      decisionEventId: row.decision_event_id,
      eventType: row.event_type,
      eventDate: row.event_date,
      effectiveDate: row.effective_date,
      title: row.title,
      summary: row.summary,
      jurisdictionId: row.jurisdiction_id,
      jurisdictionType: row.jurisdiction_type as DecisionEventDetail['jurisdictionType'],
      jurisdictionName: row.jurisdiction_name,
      dataType: row.is_demo ? 'estimate' : 'fact',
      source: {
        sourceId: row.source_doc_id,
        url: row.url,
        title: row.source_title,
        retrievedAt: row.retrieved_at?.toISOString() ?? null,
        publishedAt: row.published_at,
        isDemo: row.is_demo,
      },
      impacts,
      voteRecords,
      officialsAtEvent,
    });
  }

  return {
    geoUnitId,
    name,
    isDemo,
    filters: {
      taxType: taxTypeFilter ?? null,
      fromYear,
      toYear,
    },
    events,
    totalCount: events.length,
  };
}
