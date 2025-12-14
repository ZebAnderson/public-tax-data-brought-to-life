# TaxAtlas

TaxAtlas is an open-source web application that brings public tax data to life. Enter an address, neighborhood, or ZIP code to see all applicable taxes, who voted for them, and what's pending.

## Features

- **Place Search** - Search by address, neighborhood, ZIP code, or city name with fuzzy matching and alias resolution
- **Multi-Jurisdiction Tax Tracking** - See all overlapping tax jurisdictions (city, county, school district, special districts) for any location
- **Tax Burden Estimation** - View property tax, sales tax, and income tax rates with personalized burden estimates based on income and presence mode (live/work/both)
- **Accountability Timeline** - Track tax-related decisions and see how elected officials voted
- **Policy Signals** - Stay informed about proposed budgets, bills, and ballot measures before they become law
- **Source Transparency** - Every data point links to its official source document

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **UI**: [Ant Design 5](https://ant.design/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + PostGIS)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query)
- **Charts**: [Recharts](https://recharts.org/)
- **Maps**: [Leaflet](https://leafletjs.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (or local PostgreSQL with PostGIS)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/taxatlas.git
   cd taxatlas
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template and configure:
   ```bash
   cp .env.example .env
   ```

4. Set your database connection string in `.env`:
   ```
   DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
   ```

5. Run database migrations:
   ```bash
   # Using Supabase CLI
   supabase db push
   ```

6. Seed the database with pilot data:
   ```bash
   npm run ingest:all
   ```

7. Start the development server:
   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API route handlers
│   │   └── place/        # Place detail pages
│   ├── components/       # React components
│   │   ├── dashboard/    # Dashboard tab components
│   │   ├── layout/       # Layout components
│   │   └── shared/       # Reusable UI components
│   ├── api/              # API handler logic
│   │   ├── handlers/     # Business logic for each endpoint
│   │   └── middleware/   # Error handling, caching
│   ├── db/               # Database client and schema
│   ├── hooks/            # React hooks (useApi, etc.)
│   ├── lib/              # Utility functions
│   ├── styles/           # Design tokens
│   └── types/            # TypeScript types
├── scripts/
│   └── ingest/           # Data ingestion scripts
├── data/
│   └── pilot/            # Pilot dataset files
├── db/
│   └── migrations/       # SQL migration files
├── supabase/             # Supabase configuration
└── docs/                 # Documentation
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |

## Data Ingestion

TaxAtlas includes data ingestion scripts for bootstrapping the database with Census geographies and pilot datasets.

```bash
# Ingest all data for the configured pilot (default: Minneapolis)
npm run ingest:all

# Or run individual ingestion steps:
npm run ingest:geos          # Census tract/block group geometries
npm run ingest:aliases       # Place name aliases
npm run ingest:jurisdictions # Government jurisdictions
npm run ingest:taxes         # Tax instruments and rates
npm run ingest:accountability # Decisions, votes, officials
```

### What Gets Loaded (Pilot)

- **Geographies**: TIGER/Line tracts + block groups for the pilot county, plus GeoJSON for city/neighborhood/ZIP
- **Aliases**: Searchable aliases for city/neighborhood/ZIP
- **Jurisdictions**: Boundaries for state/county/city/school/special districts, plus `geo_unit_jurisdiction` overlay computed in PostGIS
- **Taxes**: Property context, sales rates, and state income brackets
- **Accountability**: Officials, decisions, votes, and policy signals

Pilot data configuration lives in `data/pilot/minneapolis/`.

## Database Schema

The schema supports the full flow from place search to tax accountability:

| Table | Description |
|-------|-------------|
| `geo_unit` | Geographic units (tracts, block groups, ZIPs, neighborhoods) |
| `place_alias` | Searchable aliases mapped to geographic units |
| `jurisdiction` | Government entities that levy taxes |
| `geo_unit_jurisdiction` | Links geographies to their governing jurisdictions (with coverage ratios) |
| `tax_instrument` | Individual tax types within jurisdictions |
| `tax_rate_snapshot` | Historical rate data with bracket support |
| `property_tax_context_snapshot` | Geo-unit-level property tax metrics by year |
| `tax_burden_estimate` | Modeled totals for live/work/both scenarios |
| `decision_event` | Tax-related decisions (votes, referendums, ordinances) |
| `decision_tax_impact` | Links decisions to affected tax instruments |
| `vote_record` / `vote_cast` | Roll call and ballot voting records |
| `person` / `office` / `term` | Elected officials and their service terms |
| `policy_signal` | Proposed/pending policy changes |
| `source_doc` | Source URLs with content hashes for provenance |
| `methodology_version` | Versioned lineage for computed/estimated data |

See [docs/taxatlas_schema.md](docs/taxatlas_schema.md) for complete schema documentation.

**Schema files:**
- Migration: `db/migrations/0001_taxatlas_schema.sql`
- Supabase migration: `supabase/migrations/20251214000000_taxatlas_schema.sql`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/resolve?q=...&state=...` | Resolve place search query to geo units |
| `GET /api/place/[geoUnitId]/summary` | Get place summary with tax burden estimate |
| `GET /api/place/[geoUnitId]/taxes` | Get detailed tax breakdown by category |
| `GET /api/place/[geoUnitId]/accountability` | Get decision timeline and voting records |
| `GET /api/place/[geoUnitId]/pending` | Get pending policy signals |
| `GET /api/person/[id]` | Get official profile and voting history |

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `TAXATLAS_PILOT` | Pilot dataset to use | `minneapolis` |
| `TIGER_YEAR` | Census TIGER vintage year | `2023` |

## Roadmap: Replacing Stubs with Real Sources

- **Geos**: Keep TIGER/Line for tracts/BGs; swap demo GeoJSON for authoritative boundaries (TIGER PLACE/COUSUB/ZCTA + city open-data neighborhoods)
- **Jurisdictions**: Ingest boundaries from authoritative datasets (TIGER STATE/COUNTY/PLACE/UNSD; state registries for special districts) and re-run the overlay
- **Taxes**: Replace stubs with:
  - State DOR publications/APIs (income brackets, sales rates)
  - City/county/school levy documents (property levy totals), parcel/value rolls where available
- **Accountability**: Replace with official legislative minutes, ordinance/budget docs, and election/ballot data

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
