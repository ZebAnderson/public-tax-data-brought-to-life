# TaxAtlas

This repo contains the TaxAtlas Postgres/PostGIS schema, example queries, and ingestion scripts for a pilot dataset.

## Database schema

- Migration (schema + indexes): `db/migrations/0001_taxatlas_schema.sql`
- Supabase migration copy: `supabase/migrations/20251214000000_taxatlas_schema.sql`
- ERD + seed notes: `docs/taxatlas_schema.md`
- Example queries (resolve/jurisdictions/tax cards/accountability): `db/queries/example_queries.sql`

## Ingestion (pilot)

### Prereqs

- Node.js `>= 20`
- A Postgres connection string with write access (Supabase `postgres` role is fine)
- Schema applied to the target DB

### Configure

1) Install deps:

`npm install`

2) Create `.env`:

`Copy-Item .env.example .env`

Set:
- `DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres`
- Optional: `TAXATLAS_PILOT=minneapolis` (default)
- Optional: `TIGER_YEAR=2023` (default)

### Run end-to-end

`npm run ingest:all`

Or run each pipeline stage:

- `npm run ingest:geos`
- `npm run ingest:jurisdictions`
- `npm run ingest:aliases`
- `npm run ingest:taxes`
- `npm run ingest:accountability`

### What gets loaded (MVP)

- **Geographies**: TIGER/Line tracts + block groups for the pilot county, plus demo GeoJSON for city/neighborhood/ZIP.
- **Aliases**: demo aliases for city/neighborhood/ZIP search.
- **Jurisdictions**: demo boundaries for state/county/city/school/special, plus `geo_unit_jurisdiction` overlay computed in PostGIS.
- **Taxes**: demo CSV/JSON inputs for property context, sales rates, and state income brackets.
- **Accountability**: demo JSON for officials, decisions, votes, and policy signals.

### Stub inputs (edit these)

Pilot data lives in `data/pilot/minneapolis/README.md`.
More detail: `docs/ingestion_plan.md`.

## Replacing stubs with real sources (roadmap)

- **Geos**: keep TIGER/Line for tracts/BGs; swap demo city/ZIP/neighborhood GeoJSON for authoritative boundaries (TIGER PLACE/COUSUB/ZCTA + city open-data neighborhoods).
- **Jurisdictions**: ingest boundaries from authoritative datasets (TIGER STATE/COUNTY/PLACE/UNSD; state registries for special districts) and re-run the overlay.
- **Taxes**: replace CSV stubs with:
  - State DOR publications/APIs (income brackets, sales rates)
  - City/county/school levy documents (property levy totals), parcel/value rolls where available
- **Accountability**: replace decisions/votes with official legislative minutes, ordinance/budget docs, and election/ballot data.
