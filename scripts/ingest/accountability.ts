/**
 * Pipeline E) Accountability
 *
 * Imports curated pilot accountability datasets:
 * - person / office / term (officials)
 * - decision events + tax impacts
 * - vote records + vote casts
 * - policy signals (pending/proposed)
 */

import { createPool, withClient, withTransaction } from './lib/db.js';
import { fileExists } from './lib/files.js';
import { log } from './lib/logger.js';
import { ensureMethodologyVersion } from './lib/methodology.js';
import { getPilotConfig } from './lib/pilots.js';
import { repoFileUrl } from './lib/urls.js';
import { readJsonFile, upsertSourceDocFromFile } from './lib/source-doc.js';
import { stableUuid } from './lib/ids.js';
import {
  getGeoUnitId,
  getJurisdictionIdByExternalId,
  upsertTaxInstrument,
  type GeoUnitType,
  type TaxType,
} from './lib/upserts.js';

type OfficialsJson = {
  persons: Array<{
    person_key: string;
    full_name: string;
    given_name?: string;
    family_name?: string;
    email?: string;
    external_ids?: Record<string, unknown>;
  }>;
  offices: Array<{
    office_key: string;
    jurisdiction_external_id: string;
    office_name: string;
    office_category?: string;
    district_geo_unit_type?: GeoUnitType | null;
    district_geo_unit_geoid?: string | null;
    seats_count?: number;
  }>;
  terms: Array<{
    person_key: string;
    office_key: string;
    start_date: string;
    end_date?: string | null;
    elected_date?: string | null;
    party?: string | null;
    metadata?: Record<string, unknown>;
  }>;
};

type DecisionsJson = {
  decisions: Array<{
    decision_key: string;
    jurisdiction_external_id: string;
    event_type: 'budget' | 'levy' | 'rate_change' | 'referendum' | 'statute' | 'ordinance' | 'other';
    event_date: string;
    effective_date?: string | null;
    title: string;
    summary?: string | null;
    details?: Record<string, unknown>;
    impacts: Array<{
      jurisdiction_external_id: string;
      tax_type: TaxType;
      instrument_name: string;
      impact_direction: 'increase' | 'decrease' | 'no_change' | 'restructure' | 'unknown';
      tax_year?: number | null;
      delta_rate_value?: number | null;
      delta_revenue_amount?: number | null;
      delta_description?: string | null;
      metadata?: Record<string, unknown>;
    }>;
    votes?: Array<{
      vote_type: 'roll_call' | 'ballot_measure' | 'referendum' | 'other';
      vote_date: string;
      question?: string | null;
      passed?: boolean | null;
      counts?: {
        yes?: number;
        no?: number;
        abstain?: number;
        absent?: number;
      };
      casts?: Array<
        | {
            person_key: string;
            vote_value: 'yes' | 'no' | 'abstain' | 'absent' | 'present' | 'other';
            weight?: number;
            notes?: string;
          }
        | {
            geo_unit_type: GeoUnitType;
            geo_unit_geoid: string;
            vote_value: 'yes' | 'no' | 'abstain' | 'absent' | 'present' | 'other';
            weight?: number;
            notes?: string;
          }
      >;
    }>;
  }>;
};

type PolicySignalsJson = {
  signals: Array<{
    signal_key: string;
    jurisdiction_external_id: string;
    tax_type?: TaxType | null;
    tax_instrument?: {
      jurisdiction_external_id: string;
      tax_type: TaxType;
      instrument_name: string;
    } | null;
    status: 'proposed' | 'pending' | 'enacted' | 'withdrawn' | 'expired' | 'unknown';
    signal_date: string;
    title: string;
    summary?: string | null;
    details?: Record<string, unknown>;
  }>;
};

async function upsertPerson(params: {
  client: any;
  personId: string;
  fullName: string;
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
  externalIds: Record<string, unknown>;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO person (
      person_id,
      full_name,
      given_name,
      family_name,
      email,
      external_ids,
      source_doc_id
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7::uuid)
    ON CONFLICT (person_id)
    DO UPDATE SET
      full_name = EXCLUDED.full_name,
      given_name = EXCLUDED.given_name,
      family_name = EXCLUDED.family_name,
      email = EXCLUDED.email,
      external_ids = EXCLUDED.external_ids,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.personId,
      params.fullName,
      params.givenName ?? null,
      params.familyName ?? null,
      params.email ?? null,
      JSON.stringify(params.externalIds),
      params.sourceDocId,
    ]
  );
}

async function upsertOffice(params: {
  client: any;
  officeId: string;
  jurisdictionId: string;
  officeName: string;
  officeCategory?: string | null;
  districtGeoUnitId?: string | null;
  seatsCount?: number | null;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO office (
      office_id,
      jurisdiction_id,
      office_name,
      office_category,
      district_geo_unit_id,
      seats_count,
      source_doc_id
    )
    VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::int, $7::uuid)
    ON CONFLICT (office_id)
    DO UPDATE SET
      jurisdiction_id = EXCLUDED.jurisdiction_id,
      office_name = EXCLUDED.office_name,
      office_category = EXCLUDED.office_category,
      district_geo_unit_id = EXCLUDED.district_geo_unit_id,
      seats_count = EXCLUDED.seats_count,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.officeId,
      params.jurisdictionId,
      params.officeName,
      params.officeCategory ?? null,
      params.districtGeoUnitId ?? null,
      params.seatsCount ?? null,
      params.sourceDocId,
    ]
  );
}

async function upsertTerm(params: {
  client: any;
  termId: string;
  personId: string;
  officeId: string;
  startDate: string;
  endDate?: string | null;
  electedDate?: string | null;
  party?: string | null;
  metadata?: Record<string, unknown>;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO term (
      term_id,
      person_id,
      office_id,
      start_date,
      end_date,
      elected_date,
      party,
      metadata,
      source_doc_id
    )
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, NULLIF($5, '')::date, NULLIF($6, '')::date, $7, $8::jsonb, $9::uuid)
    ON CONFLICT (term_id)
    DO UPDATE SET
      end_date = EXCLUDED.end_date,
      elected_date = EXCLUDED.elected_date,
      party = EXCLUDED.party,
      metadata = EXCLUDED.metadata,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.termId,
      params.personId,
      params.officeId,
      params.startDate,
      params.endDate ?? '',
      params.electedDate ?? '',
      params.party ?? null,
      JSON.stringify(params.metadata ?? {}),
      params.sourceDocId,
    ]
  );
}

async function upsertDecisionEvent(params: {
  client: any;
  decisionEventId: string;
  jurisdictionId: string;
  eventType: string;
  eventDate: string;
  effectiveDate?: string | null;
  title: string;
  summary?: string | null;
  details?: Record<string, unknown>;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO decision_event (
      decision_event_id,
      jurisdiction_id,
      event_type,
      event_date,
      effective_date,
      title,
      summary,
      details,
      source_doc_id
    )
    VALUES ($1::uuid, $2::uuid, $3::taxatlas_decision_event_type, $4::date, NULLIF($5, '')::date, $6, $7, $8::jsonb, $9::uuid)
    ON CONFLICT (decision_event_id)
    DO UPDATE SET
      jurisdiction_id = EXCLUDED.jurisdiction_id,
      event_type = EXCLUDED.event_type,
      event_date = EXCLUDED.event_date,
      effective_date = EXCLUDED.effective_date,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      details = EXCLUDED.details,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.decisionEventId,
      params.jurisdictionId,
      params.eventType,
      params.eventDate,
      params.effectiveDate ?? '',
      params.title,
      params.summary ?? null,
      JSON.stringify(params.details ?? {}),
      params.sourceDocId,
    ]
  );
}

async function upsertDecisionTaxImpact(params: {
  client: any;
  decisionEventId: string;
  taxInstrumentId: string;
  methodologyVersionId: string;
  impactDirection: string;
  taxYear?: number | null;
  deltaRateValue?: number | null;
  deltaRevenueAmount?: number | null;
  deltaDescription?: string | null;
  metadata?: Record<string, unknown>;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO decision_tax_impact (
      decision_event_id,
      tax_instrument_id,
      methodology_version_id,
      impact_direction,
      tax_year,
      delta_rate_value,
      delta_revenue_amount,
      delta_description,
      metadata,
      source_doc_id
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::taxatlas_impact_direction,
      $5::smallint,
      $6::numeric,
      $7::numeric,
      $8,
      $9::jsonb,
      $10::uuid
    )
    ON CONFLICT (decision_event_id, tax_instrument_id, methodology_version_id)
    DO UPDATE SET
      impact_direction = EXCLUDED.impact_direction,
      tax_year = EXCLUDED.tax_year,
      delta_rate_value = EXCLUDED.delta_rate_value,
      delta_revenue_amount = EXCLUDED.delta_revenue_amount,
      delta_description = EXCLUDED.delta_description,
      metadata = EXCLUDED.metadata,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.decisionEventId,
      params.taxInstrumentId,
      params.methodologyVersionId,
      params.impactDirection,
      params.taxYear ?? null,
      params.deltaRateValue ?? null,
      params.deltaRevenueAmount ?? null,
      params.deltaDescription ?? null,
      JSON.stringify(params.metadata ?? {}),
      params.sourceDocId,
    ]
  );
}

async function upsertVoteRecord(params: {
  client: any;
  voteRecordId: string;
  decisionEventId: string;
  jurisdictionId: string;
  voteType: string;
  voteDate: string;
  question?: string | null;
  passed?: boolean | null;
  yesCount?: number | null;
  noCount?: number | null;
  abstainCount?: number | null;
  absentCount?: number | null;
  metadata?: Record<string, unknown>;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO vote_record (
      vote_record_id,
      decision_event_id,
      jurisdiction_id,
      vote_type,
      vote_date,
      question,
      passed,
      yes_count,
      no_count,
      abstain_count,
      absent_count,
      metadata,
      source_doc_id
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::taxatlas_vote_record_type,
      $5::date,
      $6,
      $7,
      $8::int,
      $9::int,
      $10::int,
      $11::int,
      $12::jsonb,
      $13::uuid
    )
    ON CONFLICT (vote_record_id)
    DO UPDATE SET
      question = EXCLUDED.question,
      passed = EXCLUDED.passed,
      yes_count = EXCLUDED.yes_count,
      no_count = EXCLUDED.no_count,
      abstain_count = EXCLUDED.abstain_count,
      absent_count = EXCLUDED.absent_count,
      metadata = EXCLUDED.metadata,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.voteRecordId,
      params.decisionEventId,
      params.jurisdictionId,
      params.voteType,
      params.voteDate,
      params.question ?? null,
      params.passed ?? null,
      params.yesCount ?? null,
      params.noCount ?? null,
      params.abstainCount ?? null,
      params.absentCount ?? null,
      JSON.stringify(params.metadata ?? {}),
      params.sourceDocId,
    ]
  );
}

async function upsertVoteCast(params: {
  client: any;
  voteCastId: string;
  voteRecordId: string;
  voterPersonId?: string | null;
  voterGeoUnitId?: string | null;
  voteValue: string;
  weight?: number | null;
  notes?: string | null;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO vote_cast (
      vote_cast_id,
      vote_record_id,
      voter_person_id,
      voter_geo_unit_id,
      vote_value,
      weight,
      notes,
      source_doc_id
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::uuid,
      $5::taxatlas_vote_value,
      COALESCE($6::numeric, 1),
      $7,
      $8::uuid
    )
    ON CONFLICT (vote_cast_id)
    DO UPDATE SET
      vote_value = EXCLUDED.vote_value,
      weight = EXCLUDED.weight,
      notes = EXCLUDED.notes,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.voteCastId,
      params.voteRecordId,
      params.voterPersonId ?? null,
      params.voterGeoUnitId ?? null,
      params.voteValue,
      params.weight ?? 1,
      params.notes ?? null,
      params.sourceDocId,
    ]
  );
}

async function upsertPolicySignal(params: {
  client: any;
  policySignalId: string;
  jurisdictionId: string;
  taxInstrumentId?: string | null;
  taxType?: TaxType | null;
  status: string;
  signalDate: string;
  title: string;
  summary?: string | null;
  details?: Record<string, unknown>;
  methodologyVersionId: string;
  sourceDocId: string;
}): Promise<void> {
  await params.client.query(
    `
    INSERT INTO policy_signal (
      policy_signal_id,
      jurisdiction_id,
      tax_instrument_id,
      tax_type,
      status,
      signal_date,
      title,
      summary,
      details,
      methodology_version_id,
      source_doc_id
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::taxatlas_tax_type,
      $5::taxatlas_policy_signal_status,
      $6::date,
      $7,
      $8,
      $9::jsonb,
      $10::uuid,
      $11::uuid
    )
    ON CONFLICT (policy_signal_id)
    DO UPDATE SET
      tax_instrument_id = EXCLUDED.tax_instrument_id,
      tax_type = EXCLUDED.tax_type,
      status = EXCLUDED.status,
      signal_date = EXCLUDED.signal_date,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      details = EXCLUDED.details,
      methodology_version_id = EXCLUDED.methodology_version_id,
      source_doc_id = EXCLUDED.source_doc_id
    `,
    [
      params.policySignalId,
      params.jurisdictionId,
      params.taxInstrumentId ?? null,
      params.taxType ?? null,
      params.status,
      params.signalDate,
      params.title,
      params.summary ?? null,
      JSON.stringify(params.details ?? {}),
      params.methodologyVersionId,
      params.sourceDocId,
    ]
  );
}

async function main(): Promise<void> {
  const pilot = getPilotConfig();
  log.info(`Starting accountability ingest`, { pilot: pilot.pilotId });

  const pool = createPool();
  await withClient(pool, async (client) => {
    await withTransaction(client, async () => {
      const factMethodologyVersionId = await ensureMethodologyVersion(client, {
        ...pilot.methodologies.fact,
        description: 'Pilot accountability facts (stub inputs)',
      });
      const signalMethodologyVersionId = await ensureMethodologyVersion(client, {
        ...pilot.methodologies.signal,
        description: 'Pilot policy signals (stub inputs)',
      });

      // -------------------------------------------------------------------
      // People / offices / terms
      // -------------------------------------------------------------------
      if (!(await fileExists(pilot.paths.officialsJson))) {
        throw new Error(`Missing JSON: ${pilot.paths.officialsJson}`);
      }

      const { sourceDocId: officialsSourceDocId } = await upsertSourceDocFromFile(
        client,
        pilot.paths.officialsJson,
        repoFileUrl(pilot.paths.officialsJson),
        {
          isDemo: true,
          title: `TaxAtlas pilot officials (${pilot.pilotId})`,
          mimeType: 'application/json',
        }
      );

      const officials = await readJsonFile<OfficialsJson>(pilot.paths.officialsJson);

      const personIdByKey = new Map<string, string>();
      for (const p of officials.persons) {
        const personId = stableUuid([pilot.pilotId, 'person', p.person_key]);
        personIdByKey.set(p.person_key, personId);
        await upsertPerson({
          client,
          personId,
          fullName: p.full_name,
          givenName: p.given_name ?? null,
          familyName: p.family_name ?? null,
          email: p.email ?? null,
          externalIds: { person_key: p.person_key, ...(p.external_ids ?? {}) },
          sourceDocId: officialsSourceDocId,
        });
      }

      const officeIdByKey = new Map<string, string>();
      for (const o of officials.offices) {
        const jurisdictionId = await getJurisdictionIdByExternalId(
          client,
          pilot.stateCode,
          o.jurisdiction_external_id
        );
        if (!jurisdictionId) {
          throw new Error(`Missing jurisdiction for office: external_id=${o.jurisdiction_external_id}`);
        }

        const districtGeoUnitId =
          o.district_geo_unit_type && o.district_geo_unit_geoid
            ? await getGeoUnitId(client, o.district_geo_unit_type, o.district_geo_unit_geoid)
            : null;

        const officeId = stableUuid([
          pilot.pilotId,
          'office',
          o.jurisdiction_external_id,
          o.office_key,
          o.district_geo_unit_type ?? '',
          o.district_geo_unit_geoid ?? '',
        ]);
        officeIdByKey.set(o.office_key, officeId);

        await upsertOffice({
          client,
          officeId,
          jurisdictionId,
          officeName: o.office_name,
          officeCategory: o.office_category ?? null,
          districtGeoUnitId,
          seatsCount: o.seats_count ?? null,
          sourceDocId: officialsSourceDocId,
        });
      }

      for (const t of officials.terms) {
        const personId = personIdByKey.get(t.person_key);
        const officeId = officeIdByKey.get(t.office_key);
        if (!personId || !officeId) {
          throw new Error(`Term references missing person/office: person_key=${t.person_key} office_key=${t.office_key}`);
        }

        const termId = stableUuid([pilot.pilotId, 'term', personId, officeId, t.start_date]);
        await upsertTerm({
          client,
          termId,
          personId,
          officeId,
          startDate: t.start_date,
          endDate: t.end_date ?? null,
          electedDate: t.elected_date ?? null,
          party: t.party ?? null,
          metadata: t.metadata ?? {},
          sourceDocId: officialsSourceDocId,
        });
      }

      log.info(`Officials loaded`, {
        persons: officials.persons.length,
        offices: officials.offices.length,
        terms: officials.terms.length,
      });

      // -------------------------------------------------------------------
      // Decisions + impacts + votes
      // -------------------------------------------------------------------
      if (!(await fileExists(pilot.paths.decisionsJson))) {
        throw new Error(`Missing JSON: ${pilot.paths.decisionsJson}`);
      }

      const { sourceDocId: decisionsSourceDocId } = await upsertSourceDocFromFile(
        client,
        pilot.paths.decisionsJson,
        repoFileUrl(pilot.paths.decisionsJson),
        {
          isDemo: true,
          title: `TaxAtlas pilot decisions/votes (${pilot.pilotId})`,
          mimeType: 'application/json',
        }
      );

      const decisions = await readJsonFile<DecisionsJson>(pilot.paths.decisionsJson);

      let decisionCount = 0;
      let impactCount = 0;
      let voteRecordCount = 0;
      let voteCastCount = 0;

      for (const d of decisions.decisions) {
        const jurisdictionId = await getJurisdictionIdByExternalId(
          client,
          pilot.stateCode,
          d.jurisdiction_external_id
        );
        if (!jurisdictionId) {
          throw new Error(`Missing jurisdiction for decision: external_id=${d.jurisdiction_external_id}`);
        }

        const decisionEventId = stableUuid([
          pilot.pilotId,
          'decision_event',
          d.jurisdiction_external_id,
          d.event_type,
          d.event_date,
          d.title,
        ]);

        await upsertDecisionEvent({
          client,
          decisionEventId,
          jurisdictionId,
          eventType: d.event_type,
          eventDate: d.event_date,
          effectiveDate: d.effective_date ?? null,
          title: d.title,
          summary: d.summary ?? null,
          details: { decision_key: d.decision_key, ...(d.details ?? {}) },
          sourceDocId: decisionsSourceDocId,
        });
        decisionCount += 1;

        for (const imp of d.impacts) {
          const impactJurisdictionId = await getJurisdictionIdByExternalId(
            client,
            pilot.stateCode,
            imp.jurisdiction_external_id
          );
          if (!impactJurisdictionId) {
            throw new Error(`Missing jurisdiction for impact: external_id=${imp.jurisdiction_external_id}`);
          }

          const taxInstrumentId = await upsertTaxInstrument(client, {
            jurisdictionId: impactJurisdictionId,
            taxType: imp.tax_type,
            name: imp.instrument_name,
            metadata: { pilot: pilot.pilotId },
            sourceDocId: decisionsSourceDocId,
          });

          await upsertDecisionTaxImpact({
            client,
            decisionEventId,
            taxInstrumentId,
            methodologyVersionId: factMethodologyVersionId,
            impactDirection: imp.impact_direction,
            taxYear: imp.tax_year ?? null,
            deltaRateValue: imp.delta_rate_value ?? null,
            deltaRevenueAmount: imp.delta_revenue_amount ?? null,
            deltaDescription: imp.delta_description ?? null,
            metadata: { decision_key: d.decision_key, ...(imp.metadata ?? {}) },
            sourceDocId: decisionsSourceDocId,
          });
          impactCount += 1;
        }

        for (const vr of d.votes ?? []) {
          const voteRecordId = stableUuid([
            pilot.pilotId,
            'vote_record',
            decisionEventId,
            vr.vote_type,
            vr.vote_date,
            vr.question ?? '',
          ]);

          await upsertVoteRecord({
            client,
            voteRecordId,
            decisionEventId,
            jurisdictionId,
            voteType: vr.vote_type,
            voteDate: vr.vote_date,
            question: vr.question ?? null,
            passed: vr.passed ?? null,
            yesCount: vr.counts?.yes ?? null,
            noCount: vr.counts?.no ?? null,
            abstainCount: vr.counts?.abstain ?? null,
            absentCount: vr.counts?.absent ?? null,
            metadata: { decision_key: d.decision_key },
            sourceDocId: decisionsSourceDocId,
          });
          voteRecordCount += 1;

          for (const cast of vr.casts ?? []) {
            const castAny = cast as any;
            const voteValue = castAny.vote_value as string;
            const weight = castAny.weight as number | undefined;
            const notes = castAny.notes as string | undefined;

            let voterPersonId: string | null = null;
            let voterGeoUnitId: string | null = null;

            if (castAny.person_key) {
              voterPersonId = personIdByKey.get(castAny.person_key) ?? null;
              if (!voterPersonId) {
                throw new Error(`Vote cast references unknown person_key: ${castAny.person_key}`);
              }
            } else if (castAny.geo_unit_type && castAny.geo_unit_geoid) {
              voterGeoUnitId = await getGeoUnitId(
                client,
                castAny.geo_unit_type as GeoUnitType,
                castAny.geo_unit_geoid as string
              );
              if (!voterGeoUnitId) {
                throw new Error(
                  `Vote cast references unknown geo_unit: type=${castAny.geo_unit_type} geoid=${castAny.geo_unit_geoid}`
                );
              }
            } else {
              throw new Error(`Vote cast must include person_key or geo_unit_type+geo_unit_geoid`);
            }

            const voteCastId = stableUuid([
              pilot.pilotId,
              'vote_cast',
              voteRecordId,
              voterPersonId ?? '',
              voterGeoUnitId ?? '',
              voteValue,
              notes ?? '',
            ]);

            await upsertVoteCast({
              client,
              voteCastId,
              voteRecordId,
              voterPersonId,
              voterGeoUnitId,
              voteValue,
              weight: weight ?? 1,
              notes: notes ?? null,
              sourceDocId: decisionsSourceDocId,
            });
            voteCastCount += 1;
          }
        }
      }

      log.info(`Decisions/votes loaded`, {
        decisions: decisionCount,
        impacts: impactCount,
        voteRecords: voteRecordCount,
        voteCasts: voteCastCount,
      });

      // -------------------------------------------------------------------
      // Policy signals (optional)
      // -------------------------------------------------------------------
      if (await fileExists(pilot.paths.policySignalsJson)) {
        const { sourceDocId: signalSourceDocId } = await upsertSourceDocFromFile(
          client,
          pilot.paths.policySignalsJson,
          repoFileUrl(pilot.paths.policySignalsJson),
          {
            isDemo: true,
            title: `TaxAtlas pilot policy signals (${pilot.pilotId})`,
            mimeType: 'application/json',
          }
        );

        const signals = await readJsonFile<PolicySignalsJson>(pilot.paths.policySignalsJson);
        let signalCount = 0;

        for (const s of signals.signals) {
          const jurisdictionId = await getJurisdictionIdByExternalId(
            client,
            pilot.stateCode,
            s.jurisdiction_external_id
          );
          if (!jurisdictionId) {
            throw new Error(`Missing jurisdiction for signal: external_id=${s.jurisdiction_external_id}`);
          }

          let taxInstrumentId: string | null = null;
          let taxType: TaxType | null = (s.tax_type ?? null) as TaxType | null;

          if (s.tax_instrument) {
            const tiJurisdictionId = await getJurisdictionIdByExternalId(
              client,
              pilot.stateCode,
              s.tax_instrument.jurisdiction_external_id
            );
            if (!tiJurisdictionId) {
              throw new Error(
                `Missing jurisdiction for signal.tax_instrument: external_id=${s.tax_instrument.jurisdiction_external_id}`
              );
            }
            taxInstrumentId = await upsertTaxInstrument(client, {
              jurisdictionId: tiJurisdictionId,
              taxType: s.tax_instrument.tax_type,
              name: s.tax_instrument.instrument_name,
              metadata: { pilot: pilot.pilotId },
              sourceDocId: signalSourceDocId,
            });
            taxType = s.tax_instrument.tax_type;
          }

          const policySignalId = stableUuid([
            pilot.pilotId,
            'policy_signal',
            s.jurisdiction_external_id,
            s.signal_date,
            s.title,
          ]);

          await upsertPolicySignal({
            client,
            policySignalId,
            jurisdictionId,
            taxInstrumentId,
            taxType,
            status: s.status,
            signalDate: s.signal_date,
            title: s.title,
            summary: s.summary ?? null,
            details: { signal_key: s.signal_key, ...(s.details ?? {}) },
            methodologyVersionId: signalMethodologyVersionId,
            sourceDocId: signalSourceDocId,
          });
          signalCount += 1;
        }

        log.info(`Policy signals loaded`, { signals: signalCount });
      } else {
        log.info(`No policy_signals.json found; skipping`);
      }
    });
  });

  await pool.end();
  log.info(`Accountability ingest complete`, { pilot: pilot.pilotId });
}

main().catch((err) => {
  log.error('Accountability ingest failed', { error: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});

