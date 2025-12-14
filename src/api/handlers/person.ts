/**
 * GET /api/person/:id
 * Returns profile + terms + "footprint summary" computed from votes (fact-only)
 */

import { sql, eq, and, desc, gte } from 'drizzle-orm';
import { db, getCurrentMethodologyVersionId } from '../../db';
import { person, term, office, jurisdiction, sourceDoc, voteCast, voteRecord, decisionEvent, decisionTaxImpact, taxInstrument } from '../../db/schema';
import type {
  PersonResponse,
  TermDetail,
  VoteFootprintSummary,
  RecentVoteActivity,
  SourceReference,
} from '../../types/api';
import type { PersonIdParam } from '../../lib/validation';
import type { TaxType, ImpactDirection, VoteValue } from '../../types/database';

export async function personHandler(
  params: PersonIdParam
): Promise<PersonResponse> {
  const { id: personId } = params;

  const methodologyVersionId = await getCurrentMethodologyVersionId();

  // Get person details
  const personResult = await db
    .select({
      personId: person.personId,
      fullName: person.fullName,
      givenName: person.givenName,
      familyName: person.familyName,
      sourceDocId: sourceDoc.sourceDocId,
      url: sourceDoc.url,
      title: sourceDoc.title,
      retrievedAt: sourceDoc.retrievedAt,
      publishedAt: sourceDoc.publishedAt,
      isDemo: sourceDoc.isDemo,
    })
    .from(person)
    .innerJoin(sourceDoc, eq(person.sourceDocId, sourceDoc.sourceDocId))
    .where(eq(person.personId, personId))
    .limit(1);

  if (personResult.length === 0) {
    throw new Error(`Person not found: ${personId}`);
  }

  const personData = personResult[0];
  const today = new Date().toISOString().split('T')[0];

  // Get all terms
  const termsResult = await db.execute(sql`
    SELECT
      t.term_id,
      t.start_date,
      t.end_date,
      t.elected_date,
      t.party,
      o.office_id,
      o.office_name,
      j.jurisdiction_id,
      j.name AS jurisdiction_name,
      j.jurisdiction_type,
      CASE
        WHEN t.start_date <= ${today}::date
          AND (t.end_date IS NULL OR t.end_date >= ${today}::date)
        THEN true
        ELSE false
      END AS is_current
    FROM term t
    JOIN office o ON o.office_id = t.office_id
    JOIN jurisdiction j ON j.jurisdiction_id = o.jurisdiction_id
    WHERE t.person_id = ${personId}
    ORDER BY t.start_date DESC
  `);

  const terms: TermDetail[] = (termsResult.rows as Array<{
    term_id: string;
    start_date: string;
    end_date: string | null;
    elected_date: string | null;
    party: string | null;
    office_id: string;
    office_name: string;
    jurisdiction_id: string;
    jurisdiction_name: string;
    jurisdiction_type: string;
    is_current: boolean;
  }>).map((row) => ({
    termId: row.term_id,
    officeId: row.office_id,
    officeName: row.office_name,
    jurisdictionId: row.jurisdiction_id,
    jurisdictionName: row.jurisdiction_name,
    jurisdictionType: row.jurisdiction_type as TermDetail['jurisdictionType'],
    startDate: row.start_date,
    endDate: row.end_date,
    electedDate: row.elected_date,
    party: row.party,
    isCurrent: row.is_current,
  }));

  const currentOffices = terms.filter((t) => t.isCurrent);

  // Calculate vote footprint by tax type
  // This summarizes how the person voted on tax-affecting decisions
  const footprintResult = await db.execute(sql`
    WITH person_votes AS (
      SELECT
        vc.vote_cast_id,
        vc.vote_value,
        vr.vote_record_id,
        vr.decision_event_id,
        vr.passed
      FROM vote_cast vc
      JOIN vote_record vr ON vr.vote_record_id = vc.vote_record_id
      WHERE vc.voter_person_id = ${personId}
    ),
    vote_impacts AS (
      SELECT
        pv.vote_cast_id,
        pv.vote_value,
        pv.passed,
        ti.tax_type,
        dti.impact_direction
      FROM person_votes pv
      JOIN decision_tax_impact dti ON dti.decision_event_id = pv.decision_event_id
        AND dti.methodology_version_id = ${methodologyVersionId}
      JOIN tax_instrument ti ON ti.tax_instrument_id = dti.tax_instrument_id
    )
    SELECT
      tax_type,
      COUNT(*) FILTER (WHERE vote_value = 'yes' AND impact_direction = 'increase') AS voted_for_increase,
      COUNT(*) FILTER (WHERE vote_value = 'yes' AND impact_direction = 'decrease') AS voted_for_decrease,
      COUNT(*) FILTER (WHERE vote_value = 'no' AND impact_direction = 'increase') AS voted_against_increase,
      COUNT(*) FILTER (WHERE vote_value = 'no' AND impact_direction = 'decrease') AS voted_against_decrease,
      COUNT(*) AS total_votes
    FROM vote_impacts
    GROUP BY tax_type
    ORDER BY total_votes DESC
  `);

  const voteFootprint: VoteFootprintSummary[] = (footprintResult.rows as Array<{
    tax_type: TaxType;
    voted_for_increase: string;
    voted_for_decrease: string;
    voted_against_increase: string;
    voted_against_decrease: string;
    total_votes: string;
  }>).map((row) => ({
    taxType: row.tax_type,
    votedForIncrease: Number(row.voted_for_increase),
    votedForDecrease: Number(row.voted_for_decrease),
    votedAgainstIncrease: Number(row.voted_against_increase),
    votedAgainstDecrease: Number(row.voted_against_decrease),
    totalVotes: Number(row.total_votes),
  }));

  // Get recent vote activity (last 10)
  const recentVotesResult = await db.execute(sql`
    SELECT DISTINCT ON (de.decision_event_id)
      de.decision_event_id,
      de.event_date,
      de.title,
      j.name AS jurisdiction_name,
      ti.tax_type,
      dti.impact_direction,
      vc.vote_value,
      vr.passed,
      sd.source_doc_id,
      sd.url,
      sd.title AS source_title,
      sd.retrieved_at,
      sd.published_at,
      sd.is_demo
    FROM vote_cast vc
    JOIN vote_record vr ON vr.vote_record_id = vc.vote_record_id
    JOIN decision_event de ON de.decision_event_id = vr.decision_event_id
    JOIN jurisdiction j ON j.jurisdiction_id = de.jurisdiction_id
    JOIN source_doc sd ON sd.source_doc_id = de.source_doc_id
    JOIN decision_tax_impact dti ON dti.decision_event_id = de.decision_event_id
      AND dti.methodology_version_id = ${methodologyVersionId}
    JOIN tax_instrument ti ON ti.tax_instrument_id = dti.tax_instrument_id
    WHERE vc.voter_person_id = ${personId}
    ORDER BY de.decision_event_id, de.event_date DESC
    LIMIT 10
  `);

  const recentVotes: RecentVoteActivity[] = (recentVotesResult.rows as Array<{
    decision_event_id: string;
    event_date: string;
    title: string;
    jurisdiction_name: string;
    tax_type: TaxType;
    impact_direction: ImpactDirection;
    vote_value: VoteValue;
    passed: boolean | null;
    source_doc_id: string;
    url: string;
    source_title: string | null;
    retrieved_at: Date | null;
    published_at: string | null;
    is_demo: boolean;
  }>).map((row) => ({
    decisionEventId: row.decision_event_id,
    eventDate: row.event_date,
    title: row.title,
    jurisdictionName: row.jurisdiction_name,
    taxType: row.tax_type,
    impactDirection: row.impact_direction,
    voteValue: row.vote_value,
    passed: row.passed,
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
    personId: personData.personId,
    fullName: personData.fullName,
    givenName: personData.givenName,
    familyName: personData.familyName,
    isDemo: personData.isDemo,
    terms,
    currentOffices,
    voteFootprint,
    recentVotes,
    source: {
      sourceId: personData.sourceDocId,
      url: personData.url,
      title: personData.title,
      retrievedAt: personData.retrievedAt?.toISOString() ?? null,
      publishedAt: personData.publishedAt?.toString() ?? null,
      isDemo: personData.isDemo,
    },
  };
}
