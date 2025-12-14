# TaxAtlas UX: Income & Pay Type

## Goal
Help users understand **visible vs hidden taxes** and how pay type changes what they see (withholding) vs what is paid on their behalf (employer-side payroll taxes and programs).

## Screens

### Home (optional)
- No change required for this iteration.
- Future: add a 1-line teaser under search (“See hidden employer-side taxes for W‑2 paychecks.”) linking to the new panel once a place is selected.

### Place Dashboard (`/place/[geoUnitId]`)
**New UI: collapsible panel “Income & Pay Type”**
- Default expanded.
- Contains:
  - Segmented: `W‑2 employee` | `1099 / contractor` | `Self‑employed` | `Mixed / unsure`
  - Optional inputs:
    - `Annual wage income (W‑2)`
    - `Annual 1099 income`
    - `Annual household income`
  - Toggle: `Show employer-side taxes (hidden)` (shown for W‑2 + Mixed; default ON when W‑2 is selected)
  - Education tooltip for W‑2:
    - Explains that many W‑2 workers only see their portion in withholding; employer pays additional amounts not shown on pay stub.

### Taxes Tab
**New section: “Payroll taxes and employer-side contributions”**
- Title shown only when pay type is `W‑2` or `Mixed / unsure`.
- For other pay types, section remains but title changes to “Payroll taxes” and content shifts to contractor/self-employed framing.

**Presentation rules**
- Always label buckets:
  - Employee-paid
  - Employer-paid
  - Shared/Program fees
- Explanatory microcopy:
  - “Some taxes are paid by your employer on your behalf and may not appear in your paycheck.”
- Data tagging:
  - Fact vs Estimate vs Signal (no prediction)
  - If a program’s source isn’t ingested: show “Source: TBD”, tag as Estimate, and show warning tooltip.
- Each program row shows a source (link if available; otherwise “TBD”).

**Edit assumptions**
- Add `Edit assumptions` button near the total burden card header.
- Opens a drawer with:
  - Pay type selector
  - Income inputs
  - Spending assumptions (existing) + optional override input
  - Household size (optional)

## Component plan (Ant Design)

### New / updated components
- `IncomePayTypePanel`
  - `Card` + `Collapse`
  - `Segmented`
  - `InputNumber`
  - `Switch`
  - `Tooltip`, `Alert`
- `EditAssumptionsDrawer` (currently embedded in Taxes tab)
  - `Drawer`
  - `Segmented`
  - `Form`, `InputNumber`
  - `Switch`
  - `Alert` (disclaimer/no prediction)
- `PayrollSection` (currently embedded in Taxes tab)
  - `Card`
  - `Statistic` (totals for each bucket)
  - `Table` (program line items)
  - `Tag` (payer labels)
  - `DataTypeBadge` + warning tooltip for TBD sources

### State
- `useUserAssumptions()` context (client-side):
  - `payType`
  - income inputs
  - `showEmployerSideTaxes`
  - household size
  - optional spending override
- Persisted in `localStorage` to keep settings between sessions.

## Microcopy templates (neutral, factual)

### Panel helper text
- “Some taxes are paid by your employer on your behalf and may not appear in your paycheck.”

### W‑2 tooltip
- “Many W‑2 workers see only withholding. Employers often pay additional payroll taxes that may not appear on a pay stub.”

### TBD source warning
- “Source not ingested yet. Value is treated as an estimate until the official source is linked.”

### No predictions disclaimer
- “TaxAtlas does not predict future policy outcomes. Proposed items are labeled as SIGNAL.”

## Acceptance criteria
- Selecting `W‑2 employee`:
  - Employer-side toggle defaults ON.
  - Taxes tab shows “Payroll taxes and employer-side contributions”.
  - Payroll totals update when wage input changes and when employer-side toggle changes.
- Selecting a non‑W‑2 pay type:
  - Taxes tab payroll section changes framing/content accordingly.
  - Employer-side toggle is hidden unless pay type includes W‑2.
- Every payroll program row includes:
  - A Fact/Estimate/Signal tag.
  - A source link when available; otherwise “Source: TBD” and estimate warning tooltip.

