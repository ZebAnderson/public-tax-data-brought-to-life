# TaxAtlas — Project Vision & Requirements (Minneapolis Pilot)

## 1. Vision
TaxAtlas is a civic tax intelligence platform that allows individuals to enter a **neighborhood, ZIP code, or city** and understand:
- What taxes apply to them for **living and/or working** in that place
- How those taxes have **changed over time**
- Which **governing bodies and elected officials** voted for or signed decisions affecting those taxes
  - Includes federal legislation (omnibus bills, appropriations), congressional committee actions, state/local decisions
- What tax-related actions are **proposed or pending**, without prediction or editorialization

Core principle: **facts over vibes**. Every number is sourced. Clear distinction between **Fact**, **Estimate**, and **Signal**.

Initial pilot geography: **Minneapolis, MN (USA only)**.

---

## 2. Non‑Goals
- Not a tax filing or compliance tool
- Not partisan or advocacy-driven
- No address-level personal data required
- No prediction of future tax outcomes

---

## 3. User Experience (UX)

### 3.1 Entry
Users may enter:
- Neighborhood name (e.g., “Northeast Minneapolis”)
- ZIP code
- City name

Modes:
- Live here
- Work here
- Live + work

### 3.2 Core Screens
1. **Home / Search**
2. **Place Dashboard**
   - Tax overview cards
   - Total estimated tax burden
3. **Taxes Tab**
   - Property
   - Sales
   - State income
   - Local income (if applicable)
4. **Accountability Tab**
   - Timeline of tax-affecting decisions
   - Federal: Omnibus bills, appropriations legislation, congressional committee actions
   - State/local: Budgets, levies, rate changes, ordinances
   - Roll-call votes
   - Officials responsible (including congressional representatives, appropriations committee members)
   - **Voting pattern analysis**: Identifies elected officials who have repeatedly voted in favor of tax increases (based on vote_cast records where impact_direction indicates increases)
5. **Pending / Proposed**
   - Budgets
   - Bills
   - Referendums
6. **Methodology & Sources Drawer**

---

## 4. Data Model (Conceptual)

### 4.1 Geography
- geo_unit (canonical polygon: neighborhood / tract / zip)
- place_alias (human name → geo_unit)
- geo_unit_jurisdiction (mapping to taxing authorities)

### 4.2 Jurisdictions
- Federal
- State (Minnesota)
- County (Hennepin)
- City (Minneapolis)
- School District (MPS)
- Special districts (demo)

### 4.3 Taxes
- tax_instrument (property, sales, income, etc.)
- tax_rate_snapshot (time series)
- property_tax_context_snapshot (levies, effective rates)
- tax_burden_estimate (modeled)

### 4.4 Accountability
- decision_event (budgets, levies, rate changes, referenda, statutes, ordinances, **federal omnibus bills**, **appropriations legislation**)
- decision_tax_impact
- vote_record (roll-call votes, floor votes, **committee votes**)
- vote_cast
- person
- office
- term (including **congressional offices**, **committee memberships**)
- policy_signal (proposed / pending)

**Federal accountability scope:**
- **Omnibus bills**: Large spending bills combining multiple appropriations that may affect tax policy, deductions, credits, or federal tax rates
- **Appropriations committees**: Congressional committee actions (House/Senate Appropriations) that shape federal spending and tax-related provisions
- **Committee votes**: Track appropriations committee members' positions on tax-affecting legislation before floor votes
- Congressional representatives: Track voting records on federal tax legislation

**Voting pattern analysis:**
- **Repeat tax increase supporters**: Aggregated analysis identifying elected officials who have consistently voted "yes" on decisions with `impact_direction = 'increase'` across multiple `decision_event` records
- **Methodology**: Counts `vote_cast` records where `vote_value = 'yes'` joined with `decision_tax_impact` where `impact_direction = 'increase'`, grouped by `person_id`
- **Scope**: Applies to all jurisdictions (federal, state, county, city, school districts) and all office types
- **Presentation**: Factual, data-driven display showing count of tax-increasing votes, percentage of total tax-affecting votes, time period, and linked source documents for verification
- **Neutral framing**: Presented as voting record statistics without attribution of intent or characterization beyond factual vote counts

**Note:** Lists of elected representatives (person, office, term) can be verified and sourced from official ballot data. Official ballots published by election authorities (state/county election offices) serve as authoritative sources showing which offices and candidates appear on ballots for a given geographic area (voting district/precinct). This approach ensures representatives are sourced from verified, official election data rather than manually maintained lists. Federal representatives (House, Senate) can be verified through official congressional records and ballot data.

### 4.5 Sources
- source_doc (every fact ties to a document)
- demo data clearly labeled with `is_demo=true`
- **Official ballot data:** State/county election office ballot information serves as verified source for elected representatives by geographic area

---

## 5. Backend API (Read‑Only)

Core endpoints:
- `/api/resolve`
- `/api/place/:geoUnitId/summary`
- `/api/place/:geoUnitId/taxes`
- `/api/place/:geoUnitId/accountability`
  - Includes voting pattern analysis: officials with repeated "yes" votes on tax-increasing decisions
- `/api/place/:geoUnitId/pending`
- `/api/person/:id`
  - Includes voting history and pattern statistics for that official

Tech assumptions:
- TypeScript
- Postgres + PostGIS
- Next.js API routes or NestJS
- Strong typing, validation, caching

---

## 6. Frontend Stack
- Next.js (TypeScript)
- Ant Design
- React Query or SWR
- Recharts (trends)
- MapLibre / Leaflet (optional map preview)

Key UX rules:
- Neutral language
- Sources always visible
- Explicit labeling: Fact / Estimate / Signal
- Accessibility-first

---

## 7. Minneapolis Pilot Scope

### 7.1 Neighborhoods (Demo)
- Northeast Minneapolis
- Uptown
- North Loop
- Downtown
- Longfellow
- Powderhorn
- Dinkytown

### 7.2 Taxes (Demo Data)
- Property: City / County / School levies
- Sales: State + local + special
- Income: State brackets

Years covered: **2018–2025**

### 7.3 Accountability (Demo)
**Local/State:**
- Annual budgets
- Property tax levy resolutions
- Sales tax proposals
- School levy changes

**Federal (Demo):**
- Omnibus spending bills with tax provisions (e.g., Tax Cuts and Jobs Act, infrastructure bills)
- Appropriations committee actions affecting federal tax policy
- Congressional floor votes on tax legislation

Officials:
- **Federal:** U.S. Representatives, U.S. Senators, Appropriations Committee members (demo)
- **State/Local:** Mayor (demo), City council members (demo), County commissioners (demo)

All labeled **DEMO DATA**.

**Future Data Sources:** 
- For production, official ballot data from Minnesota Secretary of State and Hennepin County Elections can serve as verified sources to map geo_units (neighborhoods/ZIPs) to their elected representatives, ensuring accuracy and traceability back to official election records.
- Federal legislation data: Official congressional records (congress.gov), roll call votes, committee reports, and public law documents serve as verified sources for federal omnibus bills, appropriations legislation, and congressional committee actions affecting taxes.

---

## 8. Ingestion Strategy (Pilot)
- GeoJSON neighborhood polygons (demo rectangles)
- Curated alias dictionary
- JSON/CSV stubs for taxes, decisions, votes
- Idempotent ingestion scripts
- Hash + store every source_doc
- **Representatives via ballot data:** Official ballot information from election authorities (e.g., Minnesota Secretary of State, Hennepin County Elections) can be used to verify and populate person/office/term records. Ballot data shows which offices appear on ballots for each voting district/precinct, enabling geographic mapping from geo_unit to representatives.
- **Federal legislation ingestion:**
  - Official congressional records (congress.gov) for omnibus bills, appropriations legislation
  - Committee reports and public law documents as source_doc references
  - Roll call vote data from House and Senate official records
  - Appropriations committee membership and votes tracked via official congressional records

---

## 9. Guardrails
- No editorial language
- No attribution of intent
- No fabricated real-world claims
- Clear pilot disclaimer banner

---

## 10. Success Criteria (Pilot)
- “Northeast Minneapolis” resolves successfully
- Dashboard renders tax cards + trends
- Accountability timeline expands with votes
- Pending tab shows proposed items
- Every number links to a source
- Demo disclaimer visible

---

## 11. Future Expansion
- Replace demo data with official sources
- **Federal legislation tracking:** Full integration with congress.gov API, comprehensive omnibus bill tracking, real-time appropriations committee updates
- **Enhanced voting pattern analysis:**
  - Cross-jurisdiction comparison (e.g., officials who vote for tax increases across multiple levels of government)
  - Time-based trends (e.g., change in voting patterns over multiple terms)
  - Filtering by tax type (property, sales, income) and jurisdiction level
  - Comparison tools (compare voting records between officials or across jurisdictions)
- Add neighborhood comparison
- Add shareable links
- Expand to additional cities/states
- Add renter vs owner breakdowns

---

## 12. Guiding Principle
**Who taxes you, how much, and why — by neighborhood.**
