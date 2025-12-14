# Minneapolis pilot stub inputs

These files are **DEMO** placeholders to validate the end-to-end schema and UX flows. Replace them with authoritative sources when moving beyond MVP.

## Files

### `custom_geo_units.geojson`

GeoJSON FeatureCollection of non-TIGER canonical units used for search:
- `geo_unit_type`: `city` | `neighborhood` | `zip`
- `geoid`: stable key per type (e.g., `2743000`, `mpls:neighborhood:northeast`, `55401`)
- `name`: display name
- `geometry`: Polygon (EPSG:4326)

Loaded by: `scripts/ingest/geos.ts`

### `place_aliases.json`

Seeds `place_alias` rows:
- `state_code`: `MN`
- `entries[]`:
  - `geo_unit_type`, `geoid`
  - `alias_kind`: `name` or `zip`
  - `aliases[]`: either string, or `{ text, rank, preferred }`

Loaded by: `scripts/ingest/aliases.ts`

### `jurisdictions.geojson`

GeoJSON FeatureCollection for pilot jurisdictions (boundaries are demo rectangles):
- `jurisdiction_type`: `state` | `county` | `city` | `school` | `special`
- `external_id`: stable identifier used across all pilot files (e.g., `state_fips:27`)
- `parent_external_id`: optional hierarchy
- `geometry`: Polygon (EPSG:4326)

Loaded by: `scripts/ingest/jurisdictions.ts` (also computes the spatial overlay into `geo_unit_jurisdiction`).

### `property_tax_context.csv`

Property tax “card” metrics by year (one row per instrument per geo unit):
- `tax_year`
- `geo_unit_type`, `geo_unit_geoid`
- `jurisdiction_external_id`
- `instrument_name`
- Optional numeric fields (nullable): `levy_amount`, `taxable_value_amount`, `median_bill_amount`, etc.
- Optional: `effective_rate` (stored in `metadata`)

Loaded by: `scripts/ingest/taxes.ts`

### `sales_tax_rates.csv`

Sales tax rate time series:
- `jurisdiction_external_id`
- `instrument_name`
- `effective_date`, `end_date` (optional)
- `rate_value` (decimal) and `rate_unit` (e.g., `fraction`)

Loaded by: `scripts/ingest/taxes.ts`

### `state_income_tax.json`

State income tax bracket config:
- `jurisdiction_external_id`
- `instrument_name`
- `effective_date`, optional `tax_year`
- `rate_unit`
- `rate_brackets` (JSON)

Loaded by: `scripts/ingest/taxes.ts`

### `officials.json`

Curated officials for accountability views:
- `persons[]`: `{ person_key, full_name, ... }`
- `offices[]`: `{ office_key, jurisdiction_external_id, office_name, ... }`
- `terms[]`: `{ person_key, office_key, start_date, ... }`

Loaded by: `scripts/ingest/accountability.ts`

### `decisions.json`

Curated decisions with tax impacts and votes:
- `decisions[]`:
  - `decision_key`
  - `jurisdiction_external_id`, `event_type`, `event_date`, `title`
  - `impacts[]`: `{ jurisdiction_external_id, tax_type, instrument_name, impact_direction, ... }`
  - `votes[]` (optional): roll-call (`person_key`) or ballot (`geo_unit_type` + `geo_unit_geoid`)

Loaded by: `scripts/ingest/accountability.ts`

### `policy_signals.json`

Curated “pending/proposed” signals:
- `signals[]`: `{ signal_key, jurisdiction_external_id, status, signal_date, title, ... }`

Loaded by: `scripts/ingest/accountability.ts`

