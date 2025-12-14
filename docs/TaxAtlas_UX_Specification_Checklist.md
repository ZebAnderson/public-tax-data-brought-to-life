# TaxAtlas UX Specification & Implementation Checklist
## Minneapolis Pilot — Version 1.0

> **Guiding Principle:** Who taxes you, how much, and why — by neighborhood.
>
> **Core Principle:** Facts over vibes. Every number is sourced. Clear distinction between **Fact**, **Estimate**, and **Signal**.

---

# Table of Contents

1. [Information Architecture](#1-information-architecture)
2. [User Flows](#2-user-flows)
3. [Screen Specifications](#3-screen-specifications)
4. [Component Inventory](#4-component-inventory)
5. [Application States](#5-application-states)
6. [Microcopy Templates](#6-microcopy-templates)
7. [Accessibility Requirements](#7-accessibility-requirements)
8. [Pilot Success Criteria](#8-pilot-success-criteria)

---

# 1. Information Architecture

## 1.1 Sitemap

```
TaxAtlas (Minneapolis Pilot)
├── Home / Search
│   ├── Search Input (place resolver)
│   ├── Residency Mode Selector (Live / Work / Live + Work)
│   └── Recent Searches (local storage)
│
├── Place Dashboard [/place/:geoUnitId]
│   ├── Place Header (resolved location, confidence indicator)
│   ├── Tax Summary Card (total effective rate estimate)
│   ├── DEMO DATA Banner (pilot disclaimer)
│   ├── Tab Navigation
│   │   ├── Taxes Tab (default)
│   │   ├── Accountability Tab
│   │   └── Proposed/Pending Tab
│
├── Methodology Page [/methodology]
│
├── Source Drawer (overlay, contextual)
│
└── Footer
```

## 1.2 IA Checklist

- [x] URL structure supports `/place/:geoUnitId` pattern
- [x] Tab state reflected in URL hash (`#taxes`, `#accountability`, `#proposed`)
- [x] Deep linking to specific tabs works on page load
- [x] Methodology page accessible from all screens
- [x] Source drawer accessible from any sourced data point

---

# 2. User Flows

## 2.1 Flow 1: Explore Taxes in a Minneapolis Neighborhood

**Trigger:** User wants to understand tax burden in a specific neighborhood

### Steps

- [ ] **Step 1:** User lands on Home page
  - [ ] Search input visible with placeholder text
  - [ ] Default mode is "Live + Work"

- [ ] **Step 2:** User enters neighborhood name
  - [ ] Type "Northeast Minneapolis"
  - [ ] Autocomplete shows matching neighborhoods
  - [ ] User selects from dropdown

- [ ] **Step 3:** User views Place Dashboard
  - [ ] DEMO DATA banner visible at top
  - [ ] Resolved location shows with confidence badge
  - [ ] Tax Summary displays property, sales, income overview
  - [ ] Taxes tab is active by default

- [ ] **Step 4:** User explores Taxes tab
  - [ ] Property tax section expandable
  - [ ] Jurisdiction breakdown visible (City, County, School District)
  - [ ] Each rate has source icon
  - [ ] Trend chart shows 2018-2025 data

- [ ] **Step 5:** User checks Accountability tab
  - [ ] Timeline shows tax change events
  - [ ] Vote records expandable
  - [ ] Official names listed with positions

- [ ] **Step 6:** User reviews Proposed/Pending tab
  - [ ] Signal disclaimer visible
  - [ ] Pending items clearly marked as SIGNAL
  - [ ] Links to official sources provided

---

## 2.2 Flow 2: Live/Work in Different Places

**Trigger:** User lives in one Minneapolis neighborhood, works in another

### Steps

- [ ] **Step 1:** User selects "Live + Work" mode
  - [ ] Two input fields appear
  - [ ] Labels: "Where do you live?" / "Where do you work?"

- [ ] **Step 2:** User enters both locations
  - [ ] Live: "Northeast Minneapolis"
  - [ ] Work: "Downtown"
  - [ ] Both resolve successfully

- [ ] **Step 3:** User views combined dashboard
  - [ ] Clear labeling of which taxes apply where
  - [ ] Property tax: residence location
  - [ ] Income tax: both locations if applicable
  - [ ] Sales tax: varies by purchase location

---

## 2.3 Flow 3: Verify Source and Methodology

**Trigger:** User wants to verify where a specific number comes from

### Steps

- [ ] **Step 1:** User clicks source icon on any rate
  - [ ] Source Drawer opens from right
  - [ ] Focus trapped inside drawer

- [ ] **Step 2:** User reviews source details
  - [ ] Data type badge shown (FACT/ESTIMATE/SIGNAL)
  - [ ] Source name and document title displayed
  - [ ] Retrieved date visible
  - [ ] DEMO DATA indicator if applicable

- [ ] **Step 3:** User clicks external source link
  - [ ] Link opens in new tab
  - [ ] Original drawer remains open

- [ ] **Step 4:** User closes drawer
  - [ ] Escape key works
  - [ ] Click outside works
  - [ ] X button works
  - [ ] Focus returns to trigger element

---

# 3. Screen Specifications

## 3.1 Home / Search Screen

### Layout Requirements

- [ ] Logo and app name prominent
- [ ] Search input centered
- [ ] Mode toggle below search (Live / Work / Live + Work)
- [ ] Recent searches section (if any exist)
- [ ] Footer with links to Methodology, About, Privacy

### Functional Requirements

- [ ] Autocomplete triggers after 2 characters
- [ ] Debounce: 300ms
- [ ] Max 8 autocomplete results shown
- [ ] Results format: "Neighborhood (City, State)"
- [ ] Search button disabled until valid place selected
- [ ] Enter key triggers search when valid
- [ ] Recent searches stored in localStorage (max 5)
- [ ] Recent searches clickable to re-run

### Pilot Neighborhoods (must resolve)

- [ ] Northeast Minneapolis
- [ ] Uptown
- [ ] North Loop
- [ ] Downtown
- [ ] Longfellow
- [ ] Powderhorn
- [ ] Dinkytown
- [ ] ZIP codes within Minneapolis
- [ ] "Minneapolis" as city-wide search

### Example Data Structure

```json
{
  "autocompleteResults": [
    {
      "geoUnitId": "northeast-minneapolis",
      "displayName": "Northeast Minneapolis",
      "subtitle": "Hennepin County, MN",
      "type": "neighborhood"
    }
  ]
}
```

---

## 3.2 Place Dashboard (Container)

### Layout Requirements

- [ ] **DEMO DATA Banner** — persistent, not dismissible
- [ ] Place Header with resolved location name
- [ ] Confidence badge (HIGH/MEDIUM/LOW)
- [ ] Mode indicator (Live / Work / Live + Work)
- [ ] Tax Summary cards row
- [ ] Tab navigation (Taxes | Accountability | Proposed)
- [ ] Tab content area

### Functional Requirements

- [ ] DEMO banner always visible during pilot
- [ ] Confidence badge has tooltip explanation
- [ ] Tax summary shows all relevant tax categories
- [ ] Each summary card shows data type badge
- [ ] Tabs are keyboard navigable
- [ ] Tab content loads without full page refresh
- [ ] URL updates when tab changes
- [ ] "Edit Search" returns to home with place pre-filled

### DEMO Banner Text

> "This is demonstration data for the Minneapolis pilot. Numbers are illustrative and sourced where possible, but may not reflect current official rates."

### Example Data Structure

```json
{
  "place": {
    "geoUnitId": "northeast-minneapolis",
    "name": "Northeast Minneapolis",
    "type": "neighborhood",
    "confidence": "high",
    "jurisdictions": [
      { "name": "Federal", "type": "federal" },
      { "name": "Minnesota", "type": "state" },
      { "name": "Hennepin County", "type": "county" },
      { "name": "Minneapolis", "type": "city" },
      { "name": "Minneapolis Public Schools", "type": "school_district" },
      { "name": "Special Districts", "type": "special_district", "note": "e.g., transit, watershed (demo)" }
    ]
  },
  "mode": "both",
  "isDemo": true
}
```

---

## 3.3 Taxes Tab

### Layout Requirements

- [ ] **Total Tax Burden Summary** at top of tab
- [ ] Accordion for each tax category
- [ ] Property Tax section (expanded by default)
- [ ] Sales Tax section
- [ ] Federal Income Tax section
- [ ] State Income Tax section
- [ ] Local Income Tax section (if applicable)

### Total Tax Burden Summary

- [ ] Displays estimated combined tax burden
- [ ] Breakdown by tax type (property, sales, income)
- [ ] Data type badge: ESTIMATE
- [ ] Disclaimer: "Estimates based on general rates; individual circumstances vary"
- [ ] Source icons for each component

### Property Tax Section

- [ ] Effective rate displayed prominently
- [ ] Data type badge (FACT or ESTIMATE)
- [ ] Jurisdiction breakdown table:
  - [ ] Federal (note: no federal property tax)
  - [ ] Minnesota state levy
  - [ ] Hennepin County levy
  - [ ] City of Minneapolis levy
  - [ ] Minneapolis Public Schools levy
  - [ ] Special districts (if any)
  - [ ] **Total combined rate row**
- [ ] Each row has: jurisdiction name, rate, visual bar, source icon
- [ ] Total row visually distinct (bold, separator line)
- [ ] Trend chart (2018-2025)
- [ ] Change calculation shown (e.g., "+8.2% over 5 years")

### Sales Tax Section

- [ ] Combined rate displayed
- [ ] Breakdown:
  - [ ] Federal (note: no federal sales tax)
  - [ ] Minnesota state rate (6.875%)
  - [ ] Hennepin County transit (0.25%)
  - [ ] Minneapolis city (0.5%)
  - [ ] **Total combined rate row**
- [ ] Note about exemptions (groceries, clothing)
- [ ] Trend chart if rates changed

### Federal Income Tax Section

- [ ] Note: Federal income tax is progressive
- [ ] Bracket overview (simplified, 2024 brackets)
- [ ] Link to full bracket table
- [ ] Source link to IRS

### State Income Tax Section

- [ ] Note: Minnesota has progressive state income tax
- [ ] Bracket overview (simplified)
- [ ] Link to full bracket table
- [ ] Source link to MN Department of Revenue

### Income Tax Summary

- [ ] **Total estimated income tax burden row**
- [ ] Combined federal + state effective rate estimate
- [ ] Disclaimer: "Actual rate depends on income, filing status, deductions"

### Functional Requirements

- [ ] All rates have visible source icons
- [ ] Clicking source icon opens Source Drawer
- [ ] Trend charts are interactive (hover shows values)
- [ ] Charts have accessible alternatives (data table)
- [ ] Zero-rate taxes show explanatory text, not "0%"
- [ ] Missing data shows "Data not available" with reason

### Example Data Structure

```json
{
  "propertyTax": {
    "totalRate": 1.287,
    "dataType": "estimate",
    "isDemo": true,
    "jurisdictions": [
      {
        "name": "Federal",
        "rate": 0,
        "note": "No federal property tax",
        "dataType": "fact",
        "sourceId": null
      },
      {
        "name": "Minnesota (State)",
        "rate": 0,
        "note": "State levy included in county",
        "dataType": "fact",
        "sourceId": "src-mn-dor-2024"
      },
      {
        "name": "Hennepin County",
        "rate": 0.3892,
        "dataType": "fact",
        "sourceId": "src-hennepin-levy-2024"
      },
      {
        "name": "City of Minneapolis",
        "rate": 0.4521,
        "dataType": "fact",
        "sourceId": "src-mpls-levy-2024"
      },
      {
        "name": "Minneapolis Public Schools",
        "rate": 0.4457,
        "dataType": "fact",
        "sourceId": "src-mps-levy-2024"
      }
    ],
    "total": {
      "rate": 1.287,
      "dataType": "estimate",
      "label": "Total Property Tax Rate"
    },
    "trend": {
      "years": [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
      "rates": [1.12, 1.15, 1.18, 1.21, 1.24, 1.26, 1.28, 1.287]
    }
  },
  "salesTax": {
    "totalRate": 7.625,
    "dataType": "fact",
    "breakdown": [
      { "jurisdiction": "Federal", "rate": 0, "note": "No federal sales tax" },
      { "jurisdiction": "Minnesota (State)", "rate": 6.875 },
      { "jurisdiction": "Hennepin County (Transit)", "rate": 0.25 },
      { "jurisdiction": "Minneapolis", "rate": 0.5 }
    ],
    "total": {
      "rate": 7.625,
      "dataType": "fact",
      "label": "Total Sales Tax Rate"
    }
  },
  "incomeTax": {
    "federal": {
      "type": "progressive",
      "brackets": "See IRS 2024 brackets",
      "effectiveRateEstimate": null,
      "dataType": "fact",
      "sourceId": "src-irs-2024"
    },
    "state": {
      "name": "Minnesota",
      "type": "progressive",
      "topRate": 9.85,
      "brackets": "See MN DOR brackets",
      "dataType": "fact",
      "sourceId": "src-mn-dor-income-2024"
    },
    "local": {
      "rate": 0,
      "note": "No local income tax in Minneapolis",
      "dataType": "fact"
    },
    "totalEstimate": {
      "note": "Combined effective rate depends on income and filing status",
      "dataType": "estimate"
    }
  }
}
```

---

## 3.4 Accountability Tab

### Layout Requirements

- [ ] Filter bar at top (Tax Type, Jurisdiction, Year Range)
- [ ] Vertical timeline, most recent first
- [ ] Event cards on timeline
- [ ] Expandable vote records

### Event Card Requirements

- [ ] Date prominently displayed
- [ ] Event title (e.g., "Property Tax Levy Increase")
- [ ] Governing body name
- [ ] Data type badge
- [ ] Description of change (rate from X to Y)
- [ ] Decision summary (e.g., "City Council voted 9-4 to approve")
- [ ] Expandable vote record section
- [ ] Source link

### Vote Record Requirements

- [ ] Grouped by vote direction: "Voted for" / "Voted against" / "Abstained" / "Absent"
- [ ] Official name and title for each
- [ ] Neutral language only

### Minneapolis Pilot Officials (Demo)

- [ ] Mayor (demo)
- [ ] City Council members (13 wards, demo)
- [ ] Hennepin County Commissioners (demo)
- [ ] School Board members (demo)

### Functional Requirements

- [ ] Filters apply immediately without page reload
- [ ] Empty state: "No tax changes recorded for this period"
- [ ] All events link to source documents
- [ ] Vote records use neutral language only

### Neutral Language Requirements

| Action | Correct Phrasing |
|--------|------------------|
| Vote yes | "Voted for" |
| Vote no | "Voted against" |
| Executive approval | "[Name] signed" |
| Passed | "passed [X]-[Y]" |
| Failed | "did not pass [X]-[Y]" |

### Example Data Structure

```json
{
  "events": [
    {
      "id": "evt-mpls-levy-2024",
      "date": "2023-12-06",
      "taxType": "property",
      "jurisdiction": "City of Minneapolis",
      "title": "2024 Property Tax Levy Adopted",
      "description": "Levy increased 6.5% over prior year",
      "dataType": "fact",
      "isDemo": true,
      "decision": {
        "body": "Minneapolis City Council",
        "action": "voted",
        "outcome": "approved",
        "voteFor": 9,
        "voteAgainst": 4
      },
      "officials": {
        "votedFor": [
          { "name": "Demo Council Member 1", "title": "Ward 1" }
        ],
        "votedAgainst": [
          { "name": "Demo Council Member 2", "title": "Ward 2" }
        ]
      },
      "sourceId": "src-mpls-council-minutes-2023-12-06"
    }
  ]
}
```

---

## 3.5 Proposed/Pending Tab

### Layout Requirements

- [ ] **Signal Disclaimer Banner** — persistent, prominent
- [ ] Filter bar (Type, Jurisdiction)
- [ ] Cards for each pending item
- [ ] Each card clearly marked as SIGNAL

### Signal Disclaimer Text

> "Items below are proposals, pending legislation, or ballot measures. They are NOT enacted law. Outcomes are uncertain. We make no predictions."

### Pending Item Card Requirements

- [ ] SIGNAL badge (amber/orange)
- [ ] Item type label (BALLOT MEASURE / PROPOSED BUDGET / PENDING LEGISLATION)
- [ ] Title
- [ ] Jurisdiction
- [ ] Potential impact description (neutral language)
- [ ] Current status
- [ ] Link to official source
- [ ] Source icon

### Item Types for Pilot

- [ ] Proposed annual budgets
- [ ] Property tax levy proposals
- [ ] Sales tax proposals
- [ ] School levy changes
- [ ] Ballot measures

### Functional Requirements

- [ ] All items marked as SIGNAL data type
- [ ] No predictive language used
- [ ] Status reflects current procedural state
- [ ] Links open in new tab
- [ ] Empty state: "No pending items found" + last checked date
- [ ] Items sorted by relevance (nearest deadline first)

### Example Data Structure

```json
{
  "disclaimer": "Items below are proposals, pending legislation, or ballot measures. They are NOT enacted law. Outcomes are uncertain.",
  "lastChecked": "2024-12-10T08:00:00Z",
  "items": [
    {
      "id": "pending-mpls-budget-2025",
      "type": "proposed_budget",
      "dataType": "signal",
      "isDemo": true,
      "title": "FY2025 Proposed City Budget",
      "jurisdiction": "City of Minneapolis",
      "potentialImpact": "Proposed budget includes 4.2% property tax levy increase",
      "status": {
        "phase": "public_hearing",
        "description": "Public hearings scheduled December 2024"
      },
      "sourceUrl": "https://minneapolis.gov/budget",
      "sourceId": "src-mpls-proposed-budget-2025"
    }
  ]
}
```

---

## 3.6 Source Drawer

### Layout Requirements

- [ ] Slides in from right
- [ ] Width: 400px desktop, full-screen mobile
- [ ] Close button (X) in top right
- [ ] Data type section with badge and explanation
- [ ] Source details section
- [ ] External link button
- [ ] Data type legend at bottom

### Content Requirements

- [ ] **Data Type Badge** — matches source element
- [ ] **Source Name** — organization
- [ ] **Document Title** — specific document
- [ ] **Retrieved Date** — when we fetched it
- [ ] **Data Period** — what time period it covers
- [ ] **Confidence Level** — HIGH/MEDIUM/LOW with reason
- [ ] **DEMO indicator** — if demo data
- [ ] **External Link** — "View Original Source"

### Data Type Legend

| Type | Label | Description |
|------|-------|-------------|
| fact | FACT | Directly from official government source, unmodified |
| estimate | ESTIMATE | Calculated from multiple sources; actual may vary |
| signal | SIGNAL | Proposed or pending; not yet enacted |

### Functional Requirements

- [ ] Drawer opens without page navigation
- [ ] Focus trapped inside drawer when open
- [ ] Escape key closes drawer
- [ ] Click outside closes drawer
- [ ] External link has `rel="noopener noreferrer"`
- [ ] Mobile: drawer becomes full-screen modal
- [ ] Returns focus to trigger element on close

---

## 3.7 Methodology Page

### Content Sections Required

- [ ] **Introduction** — what TaxAtlas is and isn't
- [ ] **Data Sources** — where we get data
- [ ] **Tax Calculations** — how we compute rates
- [ ] **Place Resolution** — how we match searches to places
- [ ] **Data Types Explained** — FACT/ESTIMATE/SIGNAL definitions
- [ ] **Update Frequency** — how often data refreshes
- [ ] **Known Limitations** — what we can't do
- [ ] **Disclaimer** — not tax advice

### Minneapolis Pilot-Specific Content

- [ ] List of covered neighborhoods
- [ ] Jurisdictions included (Federal, State, County, City, School District)
- [ ] Years covered (2018-2025)
- [ ] DEMO data explanation
- [ ] Links to official Minneapolis/Hennepin sources

### Representative Data Sources

- [ ] Note: Official ballot data from election authorities (MN Secretary of State, Hennepin County Elections) serves as verified source for elected representatives
- [ ] Explains geographic mapping from geo_unit to representatives via voting district/precinct
- [ ] Future: ballot data will replace demo representative lists

### Functional Requirements

- [ ] Accessible without login or search
- [ ] Table of contents with anchor links
- [ ] Printable (clean print stylesheet)
- [ ] Disclaimer is prominent

---

# 4. Component Inventory

## 4.1 Core Components (Ant Design)

| Component | Base | Status |
|-----------|------|--------|
| PlaceSearch | `AutoComplete` + `Input.Search` | [x] Built |
| ModeToggle | `Radio.Group` | [x] Built |
| ConfidenceBadge | `Tag` | [x] Built |
| DataTypeBadge | `Tag` | [x] Built |
| DemoBanner | `Alert` | [x] Built |
| TaxSummaryCard | `Card` | [x] Built (TaxCard) |
| TaxCategoryAccordion | `Collapse` | [x] Built |
| JurisdictionStack | `List` | [x] Built (JurisdictionTag) |
| TrendChart | Recharts `LineChart` | [x] Built |
| AccountabilityTimeline | `Timeline` | [x] Built |
| EventCard | `Card` | [x] Built |
| VoteRecord | `List` | [x] Built (VoteBadge) |
| SignalCard | `Card` | [x] Built |
| SourceDrawer | `Drawer` | [x] Built |
| FilterBar | `Select` | [x] Built |
| DisclaimerBanner | `Alert` | [x] Built |
| PayrollSection | `Card` + `Table` | [x] Built (NEW) |
| IncomePayTypePanel | `Collapse` + `Segmented` | [x] Built (NEW) |
| MapPreview | Leaflet | [x] Built (NEW) |

## 4.2 State Components

| Component | Base | Status |
|-----------|------|--------|
| LoadingSkeleton | `Skeleton` | [x] Built |
| EmptyState | `Empty` | [x] Built |
| ErrorState | `Result` | [x] Built |
| ConfidenceWarning | `Alert` | [x] Built |

## 4.3 Layout Components

| Component | Base | Status |
|-----------|------|--------|
| AppHeader | `Layout.Header` | [x] Built (MainLayout) |
| AppFooter | `Layout.Footer` | [x] Built (MainLayout) |
| DashboardLayout | `Layout` + `Tabs` | [x] Built |
| PageContainer | `Layout.Content` | [x] Built |

---

# 5. Application States

## 5.1 Loading States

### Requirements

- [ ] Use Ant Design `Skeleton` components
- [ ] Skeleton shapes match expected content layout
- [ ] Loading appears after 200ms delay (avoid flash)
- [ ] `aria-busy="true"` on loading containers
- [ ] Search autocomplete shows "Loading suggestions..."
- [ ] Tab content shows skeleton while loading

## 5.2 Empty States

### Search No Results

- [ ] Icon: search icon
- [ ] Title: "No places found"
- [ ] Description: "We couldn't find [query]"
- [ ] Suggestions: "Try a ZIP code, city name, or neighborhood"
- [ ] Examples shown

### No Accountability Events

- [ ] Icon: document icon
- [ ] Title: "No tax changes recorded"
- [ ] Description: Explains possible reasons
- [ ] Suggestion: "Try expanding the date range"

### No Pending Items

- [ ] Icon: checkmark
- [ ] Title: "No pending items"
- [ ] Description: "No proposals found for this location"
- [ ] Shows: "Last checked: [date]"

## 5.3 Error States

### API Error

- [ ] Icon: warning
- [ ] Title: "Something went wrong"
- [ ] Description: "We couldn't load tax data"
- [ ] Action: "Try Again" button
- [ ] Secondary: "Report Issue" link

### Partial Data Failure

- [ ] Inline warning banner
- [ ] Explains which data couldn't load
- [ ] Shows available data below
- [ ] "Retry" button for failed section

## 5.4 Confidence States

### High Confidence

- [ ] Green badge
- [ ] Tooltip: "Location matched exactly to official boundaries"

### Medium Confidence

- [ ] Yellow badge
- [ ] Inline warning explaining approximation
- [ ] Suggestion: "For precise data, enter a ZIP code"

### Low Confidence

- [ ] Red badge
- [ ] Disambiguation UI shown
- [ ] Radio buttons for selecting correct place
- [ ] "View Selected" button

---

# 6. Microcopy Templates

## 6.1 Vote Actions

| Context | Correct Phrasing |
|---------|------------------|
| Council votes yes | "[Body] voted [X]-[Y] to approve" |
| Council votes no | "[Body] voted [X]-[Y]; measure did not pass" |
| Individual yes | "Voted for" |
| Individual no | "Voted against" |
| Abstain | "Abstained" |
| Absent | "Absent" |
| Unanimous | "[Body] voted unanimously to approve" |

## 6.2 Executive Actions

| Context | Correct Phrasing |
|---------|------------------|
| Mayor signs | "[Mayor Name] signed" |
| Mayor vetoes | "[Mayor Name] vetoed" |
| Governor signs | "[Governor Name] signed into law" |

## 6.3 Rate Changes

| Context | Correct Phrasing |
|---------|------------------|
| Increase | "Rate changed from [X]% to [Y]% (+[Z]%)" |
| Decrease | "Rate changed from [X]% to [Y]% (-[Z]%)" |
| No change | "Rate unchanged at [X]%" |
| New tax | "New [tax type] established at [X]%" |
| Eliminated | "[Tax type] eliminated (was [X]%)" |

## 6.4 Status Descriptions

| Context | Correct Phrasing |
|---------|------------------|
| Introduced | "Introduced [date]" |
| In committee | "Referred to [Committee Name]" |
| On ballot | "On ballot for [Election Date]" |
| Awaiting signature | "Awaiting [Official]'s action" |

## 6.5 Disclaimers

### Global Footer
> "TaxAtlas is for informational purposes only and is not tax, legal, or financial advice. Verify all information with official sources."

### Pilot Demo Banner
> "This is demonstration data for the Minneapolis pilot. Numbers are illustrative and sourced where possible, but may not reflect current official rates."

### Estimate Disclaimer
> "Rates shown are general estimates. Your actual taxes depend on property value, income, exemptions, and other individual factors."

### Signal Disclaimer
> "Items below are proposals, pending legislation, or ballot measures. They are NOT enacted law. Outcomes are uncertain. We make no predictions."

## 6.6 Error Messages

| Error | Message |
|-------|---------|
| No results | "No places found for [query]. Try a ZIP code, city name, or neighborhood." |
| API timeout | "This is taking longer than expected. Please wait or try again." |
| API error | "Something went wrong loading this data. Please try again." |
| Partial failure | "Some data couldn't be loaded. Showing available information." |

---

# 7. Accessibility Requirements

## 7.1 WCAG 2.1 AA Compliance

### Perceivable

- [ ] All icons have `aria-label`
- [ ] Charts have data table alternatives
- [ ] Semantic HTML structure (proper heading hierarchy)
- [ ] 4.5:1 contrast ratio for text
- [ ] 3:1 contrast ratio for UI components
- [ ] Color never used alone to convey meaning

### Operable

- [ ] All interactive elements keyboard accessible
- [ ] Logical tab order
- [ ] No time limits on interactions
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Skip links present
- [ ] Focus management for drawers/modals

### Understandable

- [ ] Plain language (8th-grade reading level target)
- [ ] Consistent navigation
- [ ] Clear error messages
- [ ] Labels for all form inputs

### Robust

- [ ] Valid HTML5
- [ ] ARIA landmarks used correctly
- [ ] Tested with screen readers

## 7.2 Focus Management

- [ ] Source Drawer: focus moves to drawer on open
- [ ] Source Drawer: focus trapped inside
- [ ] Source Drawer: focus returns to trigger on close
- [ ] Autocomplete: arrow keys navigate options
- [ ] Tabs: arrow keys switch tabs
- [ ] Accordion: Enter/Space toggles

## 7.3 Screen Reader Announcements

| Action | Announcement |
|--------|--------------|
| Search results load | "[N] places found for [query]" |
| Dashboard loaded | "Tax information for [Place]. Taxes tab is active." |
| Tab changed | "[Tab Name] tab" |
| Drawer opened | "Source details dialog opened" |
| Drawer closed | "Dialog closed" |
| Error | "Error: [message]" |

## 7.4 Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `/` | Focus search | Global |
| `Escape` | Close drawer | Drawer open |
| `←` `→` | Navigate tabs | Tab bar focused |
| `Enter` | Expand accordion | Accordion focused |

---

# 8. Pilot Success Criteria

## 8.1 Core Functionality

- [ ] "Northeast Minneapolis" resolves successfully
- [ ] All 7 pilot neighborhoods resolve
- [ ] ZIP codes within Minneapolis resolve
- [ ] "Minneapolis" resolves as city-wide

## 8.2 Dashboard Rendering

- [ ] DEMO disclaimer banner visible on all dashboard views
- [ ] Tax summary cards render with rates
- [ ] All five tax categories display (Property, Sales, Federal Income, State Income, Local Income)
- [ ] Total tax burden estimate displayed
- [ ] Data type badges visible (FACT/ESTIMATE/SIGNAL)

## 8.3 Taxes Tab

- [ ] **Total tax burden summary displays at top**
- [ ] Property tax breakdown shows all jurisdictions (federal through local)
- [ ] Property tax shows total combined rate
- [ ] Sales tax breakdown shows federal, state, county, city
- [ ] Sales tax shows total combined rate
- [ ] Federal income tax section renders with bracket overview
- [ ] State income tax section renders
- [ ] Income tax shows combined estimate disclaimer
- [ ] Trend charts render with 2018-2025 data
- [ ] Source icons present on all rates

## 8.4 Accountability Tab

- [ ] Timeline renders with events
- [ ] Event cards show vote summaries
- [ ] Vote records expandable
- [ ] Official names and titles visible
- [ ] Neutral language used throughout

## 8.5 Proposed/Pending Tab

- [ ] Signal disclaimer visible
- [ ] Pending items marked as SIGNAL
- [ ] Status information present
- [ ] External links work

## 8.6 Source Verification

- [ ] Every number links to a source
- [ ] Source drawer opens correctly
- [ ] Source metadata displayed
- [ ] External source links work
- [ ] DEMO indicator shown where applicable

## 8.7 Trust & Transparency

- [ ] No editorial language anywhere
- [ ] No attribution of intent to officials
- [ ] No prediction language
- [ ] Clear DEMO/pilot labeling
- [ ] Methodology page accessible

---

# API Endpoint Checklist

Per the project requirements, these endpoints must be implemented:

- [x] `GET /api/resolve` — Place resolution
- [x] `GET /api/place/:geoUnitId/summary` — Tax summary (+ payroll breakdown with query params)
- [x] `GET /api/place/:geoUnitId/taxes` — Detailed tax data
- [x] `GET /api/place/:geoUnitId/accountability` — Decision events
- [x] `GET /api/place/:geoUnitId/pending` — Proposed items
- [x] `GET /api/person/:id` — Official details

### Payroll API Extension (NEW)

The `/summary` endpoint now supports payroll computation with query parameters:
- `profile_type=w2|contractor_1099|self_employed|mixed|unsure`
- `wages_annual=<number>`
- `contractor_income_annual=<number>`
- `show_employer_side=true|false`

---

# Tech Stack Verification

- [x] Next.js (TypeScript) setup
- [x] Ant Design integrated
- [x] React Query or SWR for data fetching
- [x] Recharts for trend visualization
- [x] Postgres + PostGIS for backend (Supabase)
- [x] Strong typing throughout
- [x] API validation in place (Zod schemas)
- [x] Unit testing framework (Vitest, 22 tests passing)
- [x] Drizzle ORM for database schema

---

# Payroll Tax Implementation (NEW — December 2024)

## Database Schema

- [x] `payroll_tax_snapshot` table for rates, caps, thresholds
- [x] `assumption_profile` table for ephemeral user income assumptions
- [x] New enums: `taxatlas_profile_type`, `taxatlas_payroll_category`, `taxatlas_payroll_payer`
- [x] Drizzle ORM schema updates (`src/db/schema.ts`)
- [x] TypeScript types (`src/types/database.ts`, `src/types/api.ts`)

## Payroll Tax Instruments (Demo Data)

| Instrument | Jurisdiction | Payer | Status |
|------------|--------------|-------|--------|
| Social Security (OASDI) | Federal | Shared 50/50 | [x] Seeded |
| Medicare (HI) | Federal | Shared 50/50 | [x] Seeded |
| Additional Medicare Tax | Federal | Employee only | [x] Seeded |
| Federal Unemployment (FUTA) | Federal | Employer only | [x] Seeded |
| Minnesota SUTA | State | Employer only | [x] Seeded |
| Minnesota Paid Leave | State | Shared | [x] Seeded |
| Minnesota Workforce Fee | State | Employer only | [x] Seeded |

## Tax Rate Snapshots (2018-2025)

- [x] Social Security wage base limits ($128,400 → $176,100)
- [x] Medicare rates (consistent 1.45%)
- [x] Additional Medicare surtax (0.9% above $200K)
- [x] FUTA (0.6% on first $7,000)
- [x] MN SUTA (1% new employer rate)
- [x] MN Paid Leave (0.7% total, starting 2025)
- [x] MN Workforce Fee (0.1%)

## Backend Implementation

- [x] Pure function `computePayrollBreakdown()` in `src/lib/payroll-computation.ts`
- [x] Handles wage base limits, thresholds, Additional Medicare Tax
- [x] Splits into employee/employer/program fees buckets
- [x] Returns detailed breakdown with sources and notes
- [x] Unit tests: 22 tests passing (`src/lib/payroll-computation.test.ts`)

## API Integration

- [x] `/summary` endpoint accepts payroll query params
- [x] Validation schemas in `src/lib/validation.ts`
- [x] Route handler parses and passes params
- [x] Returns `payrollBreakdown` in response when wages provided

## Frontend Integration

- [x] `PayrollSection` component uses API data when available
- [x] Falls back to client-side computation otherwise
- [x] Shows success alert when using official sources
- [x] `IncomePayTypePanel` for user input
- [x] Mock data includes sample payroll breakdown

## Seed Files

- [x] `db/seeds/minneapolis_pilot_payroll.sql` — Complete demo data
- [x] All sources marked `is_demo=true` with "DEMO DATA — " prefix
- [x] Run script: `scripts/run-seed.ts`

## Database Execution

- [x] Run seed SQL against Supabase — **COMPLETED December 13, 2024**
  - 8 payroll instruments created
  - 57 total snapshots (2018-2025)

---

*Last Updated: December 13, 2024*
*Version: 1.1 — Minneapolis Pilot + Payroll Extension*
