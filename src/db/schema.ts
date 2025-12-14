/**
 * TaxAtlas Drizzle ORM Schema
 * Mirrors the PostgreSQL schema from db/migrations/0001_taxatlas_schema.sql
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  date,
  integer,
  numeric,
  jsonb,
  char,
  bigserial,
  smallint,
  doublePrecision,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Enums
// ============================================================================

export const geoUnitTypeEnum = pgEnum('taxatlas_geo_unit_type', [
  'tract',
  'block_group',
  'zip',
  'neighborhood',
  'city',
  'county',
  'state',
  'custom',
]);

export const jurisdictionTypeEnum = pgEnum('taxatlas_jurisdiction_type', [
  'state',
  'county',
  'city',
  'school',
  'special',
  'federal',
  'other',
]);

export const taxTypeEnum = pgEnum('taxatlas_tax_type', [
  'property',
  'sales',
  'income',
  'payroll',
  'corporate',
  'excise',
  'lodging',
  'utility',
  'other',
]);

export const decisionEventTypeEnum = pgEnum('taxatlas_decision_event_type', [
  'budget',
  'levy',
  'rate_change',
  'referendum',
  'statute',
  'ordinance',
  'other',
]);

export const impactDirectionEnum = pgEnum('taxatlas_impact_direction', [
  'increase',
  'decrease',
  'no_change',
  'restructure',
  'unknown',
]);

export const voteRecordTypeEnum = pgEnum('taxatlas_vote_record_type', [
  'roll_call',
  'ballot_measure',
  'referendum',
  'other',
]);

export const voteValueEnum = pgEnum('taxatlas_vote_value', [
  'yes',
  'no',
  'abstain',
  'absent',
  'present',
  'other',
]);

export const policySignalStatusEnum = pgEnum('taxatlas_policy_signal_status', [
  'proposed',
  'pending',
  'enacted',
  'withdrawn',
  'expired',
  'unknown',
]);

export const dataKindEnum = pgEnum('taxatlas_data_kind', [
  'fact',
  'estimate',
  'signal',
]);

export const presenceModeEnum = pgEnum('taxatlas_presence_mode', [
  'live',
  'work',
  'live_work',
]);

// New enums for payroll and assumptions
export const profileTypeEnum = pgEnum('taxatlas_profile_type', [
  'w2',
  'contractor_1099',
  'self_employed',
  'mixed',
  'unsure',
]);

export const payrollCategoryEnum = pgEnum('taxatlas_payroll_category', [
  'social_security',
  'medicare',
  'federal_unemployment',
  'state_unemployment',
  'state_disability',
  'paid_leave',
  'workforce_fee',
  'local_payroll',
  'other',
]);

export const payrollPayerEnum = pgEnum('taxatlas_payroll_payer', [
  'employee',
  'employer',
  'shared',
  'self_employed',
]);

// ============================================================================
// Core Provenance Tables
// ============================================================================

export const methodologyVersion = pgTable('methodology_version', {
  methodologyVersionId: uuid('methodology_version_id').primaryKey().defaultRandom(),
  kind: dataKindEnum('kind').notNull().default('estimate'),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sourceDoc = pgTable('source_doc', {
  sourceDocId: uuid('source_doc_id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  contentSha256: char('content_sha256', { length: 64 }).notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }),
  publishedAt: date('published_at'),
  title: text('title'),
  mimeType: text('mime_type'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Geography Tables
// ============================================================================

export const geoUnit = pgTable('geo_unit', {
  geoUnitId: uuid('geo_unit_id').primaryKey().defaultRandom(),
  geoUnitType: geoUnitTypeEnum('geo_unit_type').notNull(),
  geoid: text('geoid').notNull(),
  name: text('name').notNull(),
  countryCode: char('country_code', { length: 2 }).notNull().default('US'),
  stateCode: char('state_code', { length: 2 }).notNull(),
  stateFips: char('state_fips', { length: 2 }),
  countyFips: char('county_fips', { length: 3 }),
  // Note: geom and centroid are PostGIS geometry types - handled via raw SQL
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  geoUnitTypeGeoidUnique: uniqueIndex('geo_unit_type_geoid_unique').on(table.geoUnitType, table.geoid),
  stateTypeIdx: index('geo_unit_state_type_idx').on(table.stateCode, table.geoUnitType),
  geoidIdx: index('geo_unit_geoid_idx').on(table.geoid),
}));

export const placeAlias = pgTable('place_alias', {
  placeAliasId: bigserial('place_alias_id', { mode: 'number' }).primaryKey(),
  aliasText: text('alias_text').notNull(), // citext in Postgres
  stateCode: char('state_code', { length: 2 }).notNull(),
  geoUnitId: uuid('geo_unit_id').notNull().references(() => geoUnit.geoUnitId, { onDelete: 'cascade' }),
  aliasKind: text('alias_kind').notNull().default('name'),
  aliasRank: integer('alias_rank').notNull().default(0),
  isPreferred: boolean('is_preferred').notNull().default(false),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  resolveIdx: index('place_alias_resolve_idx').on(table.aliasText, table.stateCode),
  geoUnitIdx: index('place_alias_geo_unit_idx').on(table.geoUnitId),
}));

// ============================================================================
// Jurisdiction Tables
// ============================================================================

export const jurisdiction = pgTable('jurisdiction', {
  jurisdictionId: uuid('jurisdiction_id').primaryKey().defaultRandom(),
  jurisdictionType: jurisdictionTypeEnum('jurisdiction_type').notNull(),
  name: text('name').notNull(),
  countryCode: char('country_code', { length: 2 }).notNull().default('US'),
  stateCode: char('state_code', { length: 2 }).notNull(),
  externalId: text('external_id'),
  parentJurisdictionId: uuid('parent_jurisdiction_id'),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const geoUnitJurisdiction = pgTable('geo_unit_jurisdiction', {
  geoUnitId: uuid('geo_unit_id').notNull().references(() => geoUnit.geoUnitId, { onDelete: 'cascade' }),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdiction.jurisdictionId, { onDelete: 'cascade' }),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  coverageRatio: numeric('coverage_ratio', { precision: 7, scale: 6 }).notNull(),
  coverageAreaM2: doublePrecision('coverage_area_m2'),
  notes: text('notes'),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex('geo_unit_jurisdiction_pk').on(table.geoUnitId, table.jurisdictionId, table.methodologyVersionId),
  jurisdictionIdx: index('geo_unit_jurisdiction_jurisdiction_idx').on(table.jurisdictionId, table.geoUnitId),
}));

// ============================================================================
// Tax Tables
// ============================================================================

export const taxInstrument = pgTable('tax_instrument', {
  taxInstrumentId: uuid('tax_instrument_id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdiction.jurisdictionId, { onDelete: 'cascade' }),
  taxType: taxTypeEnum('tax_type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxRateSnapshot = pgTable('tax_rate_snapshot', {
  taxRateSnapshotId: uuid('tax_rate_snapshot_id').primaryKey().defaultRandom(),
  taxInstrumentId: uuid('tax_instrument_id').notNull().references(() => taxInstrument.taxInstrumentId, { onDelete: 'cascade' }),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  taxYear: smallint('tax_year'),
  rateValue: numeric('rate_value', { precision: 18, scale: 8 }),
  rateUnit: text('rate_unit').notNull(),
  rateBrackets: jsonb('rate_brackets'),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const propertyTaxContextSnapshot = pgTable('property_tax_context_snapshot', {
  propertyTaxContextSnapshotId: uuid('property_tax_context_snapshot_id').primaryKey().defaultRandom(),
  taxInstrumentId: uuid('tax_instrument_id').notNull().references(() => taxInstrument.taxInstrumentId, { onDelete: 'cascade' }),
  geoUnitId: uuid('geo_unit_id').notNull().references(() => geoUnit.geoUnitId, { onDelete: 'cascade' }),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  taxYear: smallint('tax_year').notNull(),
  levyAmount: numeric('levy_amount', { precision: 18, scale: 2 }),
  taxableValueAmount: numeric('taxable_value_amount', { precision: 18, scale: 2 }),
  taxCapacityAmount: numeric('tax_capacity_amount', { precision: 18, scale: 2 }),
  medianBillAmount: numeric('median_bill_amount', { precision: 18, scale: 2 }),
  billP25Amount: numeric('bill_p25_amount', { precision: 18, scale: 2 }),
  billP75Amount: numeric('bill_p75_amount', { precision: 18, scale: 2 }),
  parcelCount: integer('parcel_count'),
  householdCount: integer('household_count'),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxBurdenEstimate = pgTable('tax_burden_estimate', {
  taxBurdenEstimateId: uuid('tax_burden_estimate_id').primaryKey().defaultRandom(),
  geoUnitId: uuid('geo_unit_id').notNull().references(() => geoUnit.geoUnitId, { onDelete: 'cascade' }),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  taxYear: smallint('tax_year').notNull(),
  presenceMode: presenceModeEnum('presence_mode').notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().default('USD'),
  scenario: jsonb('scenario').notNull().default({}),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  components: jsonb('components').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Decision / Accountability Tables
// ============================================================================

export const decisionEvent = pgTable('decision_event', {
  decisionEventId: uuid('decision_event_id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdiction.jurisdictionId, { onDelete: 'cascade' }),
  eventType: decisionEventTypeEnum('event_type').notNull(),
  eventDate: date('event_date').notNull(),
  effectiveDate: date('effective_date'),
  title: text('title').notNull(),
  summary: text('summary'),
  details: jsonb('details').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const decisionTaxImpact = pgTable('decision_tax_impact', {
  decisionTaxImpactId: uuid('decision_tax_impact_id').primaryKey().defaultRandom(),
  decisionEventId: uuid('decision_event_id').notNull().references(() => decisionEvent.decisionEventId, { onDelete: 'cascade' }),
  taxInstrumentId: uuid('tax_instrument_id').notNull().references(() => taxInstrument.taxInstrumentId, { onDelete: 'cascade' }),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  impactDirection: impactDirectionEnum('impact_direction').notNull(),
  taxYear: smallint('tax_year'),
  deltaRateValue: numeric('delta_rate_value', { precision: 18, scale: 8 }),
  deltaRevenueAmount: numeric('delta_revenue_amount', { precision: 18, scale: 2 }),
  deltaDescription: text('delta_description'),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// People / Officials Tables
// ============================================================================

export const person = pgTable('person', {
  personId: uuid('person_id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  givenName: text('given_name'),
  familyName: text('family_name'),
  email: text('email'),
  externalIds: jsonb('external_ids').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const office = pgTable('office', {
  officeId: uuid('office_id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdiction.jurisdictionId, { onDelete: 'cascade' }),
  officeName: text('office_name').notNull(),
  officeCategory: text('office_category'),
  districtGeoUnitId: uuid('district_geo_unit_id').references(() => geoUnit.geoUnitId),
  seatsCount: integer('seats_count'),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const term = pgTable('term', {
  termId: uuid('term_id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull().references(() => person.personId, { onDelete: 'cascade' }),
  officeId: uuid('office_id').notNull().references(() => office.officeId, { onDelete: 'cascade' }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  electedDate: date('elected_date'),
  party: text('party'),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Vote Tables
// ============================================================================

export const voteRecord = pgTable('vote_record', {
  voteRecordId: uuid('vote_record_id').primaryKey().defaultRandom(),
  decisionEventId: uuid('decision_event_id').notNull().references(() => decisionEvent.decisionEventId, { onDelete: 'cascade' }),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdiction.jurisdictionId, { onDelete: 'cascade' }),
  voteType: voteRecordTypeEnum('vote_type').notNull(),
  voteDate: date('vote_date').notNull(),
  question: text('question'),
  passed: boolean('passed'),
  yesCount: integer('yes_count'),
  noCount: integer('no_count'),
  abstainCount: integer('abstain_count'),
  absentCount: integer('absent_count'),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const voteCast = pgTable('vote_cast', {
  voteCastId: uuid('vote_cast_id').primaryKey().defaultRandom(),
  voteRecordId: uuid('vote_record_id').notNull().references(() => voteRecord.voteRecordId, { onDelete: 'cascade' }),
  voterPersonId: uuid('voter_person_id').references(() => person.personId, { onDelete: 'cascade' }),
  voterGeoUnitId: uuid('voter_geo_unit_id').references(() => geoUnit.geoUnitId, { onDelete: 'cascade' }),
  voteValue: voteValueEnum('vote_value').notNull(),
  weight: numeric('weight', { precision: 18, scale: 6 }).notNull().default('1'),
  notes: text('notes'),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Policy Signal Table (Pending/Proposed)
// ============================================================================

export const policySignal = pgTable('policy_signal', {
  policySignalId: uuid('policy_signal_id').primaryKey().defaultRandom(),
  jurisdictionId: uuid('jurisdiction_id').notNull().references(() => jurisdiction.jurisdictionId, { onDelete: 'cascade' }),
  taxInstrumentId: uuid('tax_instrument_id').references(() => taxInstrument.taxInstrumentId, { onDelete: 'set null' }),
  taxType: taxTypeEnum('tax_type'),
  status: policySignalStatusEnum('status').notNull(),
  signalDate: date('signal_date').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  details: jsonb('details').notNull().default({}),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Assumption Profile Table (Ephemeral, Privacy-First)
// ============================================================================

export const assumptionProfile = pgTable('assumption_profile', {
  assumptionProfileId: uuid('assumption_profile_id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().defaultRandom(),
  geoUnitId: uuid('geo_unit_id').references(() => geoUnit.geoUnitId, { onDelete: 'set null' }),
  profileType: profileTypeEnum('profile_type').notNull().default('unsure'),
  wagesAnnual: numeric('wages_annual', { precision: 18, scale: 2 }),
  contractorIncomeAnnual: numeric('contractor_income_annual', { precision: 18, scale: 2 }),
  householdIncomeAnnual: numeric('household_income_annual', { precision: 18, scale: 2 }),
  showEmployerSide: boolean('show_employer_side').notNull().default(true),
  spendingAnnualTaxable: numeric('spending_annual_taxable', { precision: 18, scale: 2 }),
  householdSize: integer('household_size'),
  methodologyVersion: text('methodology_version').notNull().default('v1.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  sessionIdx: index('assumption_profile_session_idx').on(table.sessionId),
  expiresIdx: index('assumption_profile_expires_idx').on(table.expiresAt),
  geoUnitIdx: index('assumption_profile_geo_unit_idx').on(table.geoUnitId),
}));

// ============================================================================
// Payroll Tax Snapshot Table
// ============================================================================

export const payrollTaxSnapshot = pgTable('payroll_tax_snapshot', {
  payrollTaxSnapshotId: uuid('payroll_tax_snapshot_id').primaryKey().defaultRandom(),
  taxInstrumentId: uuid('tax_instrument_id').notNull().references(() => taxInstrument.taxInstrumentId, { onDelete: 'cascade' }),
  methodologyVersionId: uuid('methodology_version_id').notNull().references(() => methodologyVersion.methodologyVersionId),
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  taxYear: smallint('tax_year').notNull(),
  payrollCategory: payrollCategoryEnum('payroll_category').notNull(),
  payerType: payrollPayerEnum('payer_type').notNull(),
  employeeRate: numeric('employee_rate', { precision: 10, scale: 6 }),
  employerRate: numeric('employer_rate', { precision: 10, scale: 6 }),
  selfEmployedRate: numeric('self_employed_rate', { precision: 10, scale: 6 }),
  wageBaseLimit: numeric('wage_base_limit', { precision: 18, scale: 2 }),
  wageFloor: numeric('wage_floor', { precision: 18, scale: 2 }),
  thresholds: jsonb('thresholds').notNull().default({}),
  metadata: jsonb('metadata').notNull().default({}),
  sourceDocId: uuid('source_doc_id').notNull().references(() => sourceDoc.sourceDocId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  instrumentYearIdx: index('payroll_tax_snapshot_instrument_year_idx').on(table.taxInstrumentId, table.taxYear),
  categoryIdx: index('payroll_tax_snapshot_category_idx').on(table.payrollCategory, table.taxYear),
  effectiveIdx: index('payroll_tax_snapshot_effective_idx').on(table.effectiveDate),
}));

// ============================================================================
// Relations
// ============================================================================

export const geoUnitRelations = relations(geoUnit, ({ one, many }) => ({
  sourceDoc: one(sourceDoc, {
    fields: [geoUnit.sourceDocId],
    references: [sourceDoc.sourceDocId],
  }),
  placeAliases: many(placeAlias),
  geoUnitJurisdictions: many(geoUnitJurisdiction),
}));

export const placeAliasRelations = relations(placeAlias, ({ one }) => ({
  geoUnit: one(geoUnit, {
    fields: [placeAlias.geoUnitId],
    references: [geoUnit.geoUnitId],
  }),
  sourceDoc: one(sourceDoc, {
    fields: [placeAlias.sourceDocId],
    references: [sourceDoc.sourceDocId],
  }),
}));

export const jurisdictionRelations = relations(jurisdiction, ({ one, many }) => ({
  sourceDoc: one(sourceDoc, {
    fields: [jurisdiction.sourceDocId],
    references: [sourceDoc.sourceDocId],
  }),
  parentJurisdiction: one(jurisdiction, {
    fields: [jurisdiction.parentJurisdictionId],
    references: [jurisdiction.jurisdictionId],
  }),
  taxInstruments: many(taxInstrument),
  decisionEvents: many(decisionEvent),
  offices: many(office),
}));

export const taxInstrumentRelations = relations(taxInstrument, ({ one, many }) => ({
  jurisdiction: one(jurisdiction, {
    fields: [taxInstrument.jurisdictionId],
    references: [jurisdiction.jurisdictionId],
  }),
  sourceDoc: one(sourceDoc, {
    fields: [taxInstrument.sourceDocId],
    references: [sourceDoc.sourceDocId],
  }),
  rateSnapshots: many(taxRateSnapshot),
  propertyContextSnapshots: many(propertyTaxContextSnapshot),
  payrollSnapshots: many(payrollTaxSnapshot),
}));

export const personRelations = relations(person, ({ one, many }) => ({
  sourceDoc: one(sourceDoc, {
    fields: [person.sourceDocId],
    references: [sourceDoc.sourceDocId],
  }),
  terms: many(term),
  votes: many(voteCast),
}));

export const termRelations = relations(term, ({ one }) => ({
  person: one(person, {
    fields: [term.personId],
    references: [person.personId],
  }),
  office: one(office, {
    fields: [term.officeId],
    references: [office.officeId],
  }),
}));

export const assumptionProfileRelations = relations(assumptionProfile, ({ one }) => ({
  geoUnit: one(geoUnit, {
    fields: [assumptionProfile.geoUnitId],
    references: [geoUnit.geoUnitId],
  }),
}));

export const payrollTaxSnapshotRelations = relations(payrollTaxSnapshot, ({ one }) => ({
  taxInstrument: one(taxInstrument, {
    fields: [payrollTaxSnapshot.taxInstrumentId],
    references: [taxInstrument.taxInstrumentId],
  }),
  methodologyVersion: one(methodologyVersion, {
    fields: [payrollTaxSnapshot.methodologyVersionId],
    references: [methodologyVersion.methodologyVersionId],
  }),
  sourceDoc: one(sourceDoc, {
    fields: [payrollTaxSnapshot.sourceDocId],
    references: [sourceDoc.sourceDocId],
  }),
}));
