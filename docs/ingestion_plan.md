# TaxAtlas ingestion plan (pragmatic, scalable)

This describes how we populate the TaxAtlas Postgres/PostGIS schema for a **pilot** while keeping the approach scalable to many counties/states.

## Principles

- **Idempotent writes**: every pipeline uses deterministic keys + `INSERT ... ON CONFLICT ... DO UPDATE`.
- **Traceability**: every inserted fact references a `source_doc` (URL + content SHA-256).
- **Explicit labeling**: `source_doc.is_demo` marks demo datasets; `methodology_version.kind` supports Fact vs Estimate vs Signal.
- **Geospatial work in PostGIS**: expensive overlays happen in SQL using GiST indexes.
- **Nationwide scaling**: ingest is driven by a `PilotConfig` (state/county/city); add more pilots by adding configs and running the same scripts.

## Pipeline layout

### A) Geographies (`scripts/ingest/geos.ts`)

**MVP**
- Download TIGER/Line tract + block group shapefiles for the pilot state.
- Filter features to the pilot county (by `COUNTYFP`) before inserting.
- Upsert into `geo_unit` with:
  - `geo_unit_type`: `tract` / `block_group`
  - `geoid`: TIGER GEOID
  - `geom`: stored as EPSG:4326 MultiPolygon (TIGER NAD83 → transformed in SQL)
- Load pilot “custom” units (city/neighborhood/ZIP) from a small GeoJSON file.

**Scale-up**
- Add ZCTA ingestion from TIGER `ZCTA5` for ZIP polygons (or USPS-derived boundaries where licensing allows).
- Add neighborhood boundaries from city open data portals and curate alias sets per city.
- For nationwide, run per state/county in parallel and use `COPY` into staging tables for speed.

### B) Place aliases (`scripts/ingest/aliases.ts`)

**MVP**
- Read a curated alias JSON file.
- For each alias entry, resolve its `geo_unit_id` by `(geo_unit_type, geoid)`.
- Upsert into `place_alias` keyed by `(alias_text, state_code, geo_unit_id, alias_kind)`.

**Scale-up**
- Generate systematic aliases (ZIP, GEOID, common “City of …” variants).
- Add normalization and a separate `place_alias_normalized` column if you need more aggressive matching.

### C) Jurisdictions + overlay (`scripts/ingest/jurisdictions.ts`)

**MVP**
- Upsert pilot `jurisdiction` boundaries from GeoJSON (state/county/city/school/special).
- Compute `geo_unit_jurisdiction` via spatial overlay:
  - `coverage_ratio = area(intersection) / area(geo_unit)`
  - Stored under a dedicated `methodology_version` (kind `estimate`).

**Scale-up**
- Replace demo boundaries with authoritative datasets:
  - TIGER: STATE, COUNTY, PLACE, UNSD (school districts)
  - State registries for special districts (where available)
- Re-run overlay per methodology version/vintage; keep old versions for reproducibility.

### D) Taxes (`scripts/ingest/taxes.ts`)

**MVP**
- Property context snapshots (CSV): `property_tax_context_snapshot` for city-level “tax cards”.
- Sales tax rates (CSV): `tax_rate_snapshot` for state/county/city/special.
- State income tax brackets (JSON): `tax_rate_snapshot.rate_brackets` for progressive structures.

**Scale-up**
- Treat official published rates as `methodology_version.kind='fact'` and modeled allocations as `kind='estimate'`.
- Add ingestion adapters for:
  - State DOR publications/APIs (income and sales)
  - Local levy docs + CAFRs (property)
  - Parcel/value rolls where available (for geo allocation)

### E) Accountability (`scripts/ingest/accountability.ts`)

**MVP**
- Officials: `person`, `office`, `term` from curated JSON (deterministic IDs).
- Decisions: `decision_event` + `decision_tax_impact` from curated JSON.
- Votes: `vote_record` + `vote_cast` (supports roll-call and ballot measures).
- Signals: `policy_signal` (optional file).

**Scale-up**
- Store one `source_doc` per decision/vote URL by downloading the doc and hashing content (strong provenance).
- Prefer authoritative election/ballot datasets for representatives by geography.
- Add QC checks (e.g., every decision has ≥1 impact; every roll-call vote has a matching term).

## Orchestration order

Recommended run order:
1) `geos.ts`
2) `jurisdictions.ts` (needs `geo_unit.geom`)
3) `aliases.ts` (needs `geo_unit` IDs)
4) `taxes.ts` (needs jurisdictions + geo units)
5) `accountability.ts` (needs jurisdictions + geo units + instruments)

## Validation queries (quick sanity checks)

- Ensure place resolution works:
  - `SELECT * FROM place_alias WHERE alias_text='Minneapolis';`
- Ensure overlay exists:
  - `SELECT COUNT(*) FROM geo_unit_jurisdiction;`
- Ensure property contexts exist:
  - `SELECT COUNT(*) FROM property_tax_context_snapshot;`
- Ensure decisions exist:
  - `SELECT COUNT(*) FROM decision_event;`

