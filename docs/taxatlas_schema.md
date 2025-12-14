# TaxAtlas Postgres + PostGIS schema (ERD notes)

This doc is a human-readable explanation of the schema in `db/migrations/0001_taxatlas_schema.sql`.

## Core flow (search → taxes → accountability)

1. **User searches a place string** → `place_alias(alias_text, state_code)` resolves to a canonical **geo unit**.
2. **Canonical geography** → `geo_unit` stores the polygon (tract / block group / ZIP / neighborhood / etc).
3. **Applicable governments** → `geo_unit_jurisdiction` links a `geo_unit` to one or more `jurisdiction` rows (with `coverage_ratio` for partial overlaps).
4. **Tax instruments** → each `tax_instrument` belongs to a `jurisdiction` and has a `tax_type` (property/sales/income/etc).
5. **Time series + summaries**
   - `tax_rate_snapshot`: rate history for a `tax_instrument` (supports bracketed/progressive taxes via `rate_brackets` JSONB).
   - `property_tax_context_snapshot`: geo-unit-level property tax “card” metrics by year (levy/value/median bill), keyed by (`geo_unit_id`, `tax_instrument_id`, `tax_year`).
   - `tax_burden_estimate`: modeled totals for “live here / work here / live+work” with scenario assumptions + component breakdowns.
6. **Decisions + votes + officials**
   - `decision_event`: a dated action in a `jurisdiction` (budget/levy/rate change/referendum/statute/ordinance).
   - `decision_tax_impact`: links a `decision_event` to the affected `tax_instrument`(s) with direction and deltas.
   - `vote_record`: one voting session tied to a `decision_event` (roll call or ballot).
   - `vote_cast`: individual roll-call votes (`voter_person_id`) or aggregated ballot results (`voter_geo_unit_id`).
   - `person`, `office`, `term`: officials and their service terms (an `office` belongs to a `jurisdiction`).
7. **Early warnings**
   - `policy_signal`: proposed/pending signals before decisions; can target a `tax_instrument` or just a `tax_type` within a `jurisdiction`.

## Provenance + methodology (required for “facts”)

- `source_doc`: canonical source URL + SHA-256 content hash; most rows in “fact” tables reference one `source_doc_id`.
- Demo labeling: `source_doc.is_demo=true` can be used to mark pilot/demo datasets and propagate that flag through joins.
- `methodology_version`: versioned lineage for computed/estimated products.
  - Used by: `geo_unit_jurisdiction`, `tax_rate_snapshot`, `property_tax_context_snapshot`, `decision_tax_impact`, `policy_signal`.
  - Allows multiple competing estimate sets to coexist (e.g., “v1 allocated-by-area” vs “v2 allocated-by-parcels”).
  - `methodology_version.kind` can be used by the UI to label outputs as **Fact** vs **Estimate** vs **Signal**.

## Main relationships (ERD-style)

- `place_alias.geo_unit_id → geo_unit.geo_unit_id`
- `geo_unit_jurisdiction.geo_unit_id → geo_unit.geo_unit_id`
- `geo_unit_jurisdiction.jurisdiction_id → jurisdiction.jurisdiction_id`
- `tax_instrument.jurisdiction_id → jurisdiction.jurisdiction_id`
- `tax_rate_snapshot.tax_instrument_id → tax_instrument.tax_instrument_id`
- `property_tax_context_snapshot.(geo_unit_id, tax_instrument_id) → (geo_unit, tax_instrument)`
- `tax_burden_estimate.geo_unit_id → geo_unit.geo_unit_id`
- `decision_event.jurisdiction_id → jurisdiction.jurisdiction_id`
- `decision_tax_impact.decision_event_id → decision_event.decision_event_id`
- `decision_tax_impact.tax_instrument_id → tax_instrument.tax_instrument_id`
- `vote_record.decision_event_id → decision_event.decision_event_id`
- `vote_cast.vote_record_id → vote_record.vote_record_id`
- `vote_cast.voter_person_id → person.person_id` (XOR with `voter_geo_unit_id`)
- `office.jurisdiction_id → jurisdiction.jurisdiction_id`
- `term.person_id → person.person_id`
- `term.office_id → office.office_id`
- `policy_signal.jurisdiction_id → jurisdiction.jurisdiction_id`
- `policy_signal.tax_instrument_id → tax_instrument.tax_instrument_id` (optional)

## Seed / bootstrapping strategy (high level)

### 1) Load Census geometries into `geo_unit`

Recommended approach: ingest with `ogr2ogr`/`shp2pgsql` into staging, then insert into `geo_unit`.

- **Tracts / block groups**: TIGER/Line shapefiles (GEOID, NAME, geometry).
  - `geo_unit_type`: `tract` / `block_group`
  - `geoid`: TIGER GEOID (state+county+tract(+bg))
  - `source_doc`: the TIGER/Line release URL + hash (one row per vintage)
- **ZIP**: ZCTA polygons (US Census).
  - `geo_unit_type`: `zip`
  - `geoid`: 5-digit ZCTA
- **Neighborhoods**: city open-data neighborhood boundaries (or curated internal polygons).
  - `geo_unit_type`: `neighborhood`
  - `geoid`: stable internal key like `neighborhood:seattle:ballard`

### 2) Build `place_alias` dictionary

Start with deterministic aliases:

- Official names from `geo_unit.name` (and jurisdiction names if you choose to add “city as geo_unit” rows).
- Canonical IDs as aliases:
  - tract/block group GEOID
  - ZIP code
- Curated alternates:
  - common abbreviations, “City of …” variations, punctuation/whitespace variants

Use `alias_rank` + `is_preferred` for disambiguation, and keep provenance via `source_doc_id`.

### 3) Seed `jurisdiction` and `geo_unit_jurisdiction`

Two common options:

1. **Spatial overlay** (when jurisdiction boundaries are polygons):
   - Load each jurisdiction boundary into `jurisdiction.geom`
   - Compute intersections with `geo_unit.geom`:
     - `coverage_ratio = ST_Area(ST_Intersection(j.geom, gu.geom)::geography) / ST_Area(gu.geom::geography)`
   - Insert into `geo_unit_jurisdiction` with a chosen `methodology_version`

2. **Authoritative crosswalks** (when available):
   - Use state/county FIPS, NCES IDs for schools, special district registries, etc.
   - Insert mappings directly (coverage ratios can be set to `1` when relationships are crisp)

## Performance notes (why the indexes exist)

- `place_alias_resolve_idx` supports exact alias resolution (with ranked disambiguation).
- `property_tax_context_geo_method_year_idx` supports “geo_unit summary by year”.
- `tax_rate_snapshot_instrument_effective_idx` supports instrument time series and “latest rate”.
- `decision_event_jurisdiction_date_idx` + `decision_tax_impact_instrument_idx` support timeline filtering by geo_unit → jurisdiction → instrument → decisions.
