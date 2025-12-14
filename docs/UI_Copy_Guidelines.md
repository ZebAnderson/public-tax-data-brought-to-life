# TaxAtlas UI Copy Guidelines

## Overview

TaxAtlas presents tax data to help users understand their tax obligations. Our copy must be **neutral, factual, and non-editorializing**. We report what happened; we do not tell users how to feel about it.

---

## Core Principles

### 1. State Facts, Not Opinions
- **Do:** "Property tax rate increased 6.5% from 2023 to 2024"
- **Don't:** "Property tax rate unfortunately increased 6.5%"

### 2. Attribute to Sources, Not Judgments
- **Do:** "Source: Hennepin County Property Tax Records"
- **Don't:** "According to the bureaucrats at Hennepin County"

### 3. Use Neutral Verbs
| Avoid | Use Instead |
|-------|-------------|
| raised, hiked, jacked | increased |
| slashed, gutted | decreased, reduced |
| passed | adopted |
| killed, blocked | did not advance |
| blamed | attributed to |

### 4. No Second-Person Blame
- **Do:** "The levy was adopted with a 9-4 vote"
- **Don't:** "Your council voted to raise your taxes"

### 5. Present Information, Not Predictions
- **Do:** "If adopted as proposed, the rate would increase 4.2%"
- **Don't:** "This will definitely pass and cost you more"

---

## Data Type Labeling

Every data point must be labeled with one of three types:

### FACT
- **Definition:** Data directly from official government sources with no calculation
- **Visual:** Green badge/icon
- **Examples:**
  - Tax rates from official schedules
  - Vote records from meeting minutes
  - Levy amounts from budget documents
- **Tooltip:** "This data comes directly from official government records."

### ESTIMATE
- **Definition:** Calculated values based on official data and documented assumptions
- **Visual:** Yellow/gold badge/icon
- **Examples:**
  - Combined tax rates across jurisdictions
  - Annual burden estimates
  - Weighted averages
- **Tooltip:** "This value is calculated from official data using documented methods."

### SIGNAL
- **Definition:** Proposed or pending items that are NOT enacted law
- **Visual:** Purple badge/icon
- **Examples:**
  - Proposed budgets
  - Pending legislation
  - Upcoming ballot measures
- **Tooltip:** "This is a proposal or pending item. Outcomes are not certain."

---

## Copy Templates by Section

### Tax Card Summaries

```
[Tax Type] Tax
Rate: [X.XX]%
[N] taxing jurisdictions
Source: [Source Name]
```

**Notes (optional):**
- "Effective rate varies by property classification"
- "Some goods and services may be exempt"
- "Effective rate depends on income level"

### Trend Labels

| Direction | Label | Description |
|-----------|-------|-------------|
| Increase | ↑ X.X% | "Increased X.X% from [year] to [year]" |
| Decrease | ↓ X.X% | "Decreased X.X% from [year] to [year]" |
| Stable | → No change | "Remained stable from [year] to [year]" |

### Vote Display

**Individual votes:**
- "Voted Yes"
- "Voted No"
- "Abstained"
- "Absent"

**Summary:**
- "Passed (9–4)"
- "Did not pass (4–9)"
- "Passed unanimously (13–0)"

**Never say:**
- "Voted FOR/AGAINST raising taxes"
- "Supported/opposed the increase"

### Signatory Actions

- "Signed by [Office Name]"
- "Vetoed by [Office Name]"
- "Became law without signature"
- "Veto overridden (X–X)"

### Pending Item Status

| Status | Label |
|--------|-------|
| In proposal stage | "Proposed" |
| Filed/submitted | "Introduced" |
| Awaiting action | "Pending" |
| Being reviewed | "In Committee" |
| Vote scheduled | "Scheduled for Vote" |
| On upcoming ballot | "On Ballot" |

**Impact language:**
- "If adopted as proposed..."
- "Potential impact if enacted..."
- Never: "Will cost you..." or "You'll pay more..."

---

## Required Disclaimers

### General (footer/about page)
> This data is provided for informational purposes only. Always verify with official government sources before making financial decisions.

### Estimates
> Based on median household assumptions. Your actual tax burden may differ.

### Pending Items (must display prominently)
> Items below are proposals, pending legislation, or ballot measures. They are NOT enacted law. Outcomes are uncertain. We make no predictions.

### Demo Mode
> DEMO: This data is representative only. Not actual tax information.

---

## Disallowed Language

### Blame/Causation Words
❌ blame, fault, responsible for raising, caused your taxes, cost you, jacked, hiked, slapped

### Editorial Words
❌ unfortunately, sadly, thankfully, alarming, shocking, outrageous, good news, bad news

### Prediction Words
❌ will definitely, guaranteed to, expected to pass, likely to fail, doomed

### Political Slant
❌ tax-and-spend, fiscally irresponsible, pro-tax, anti-tax, big government, wasteful

### Informal/Charged Language
❌ jacked up, slashed, gutted, rammed through, snuck in, backroom deal

---

## Accessibility Requirements

### Screen Reader Labels
- Tax cards: "[Type] tax rate card showing [rate]"
- Charts: "[Type] rate trend from [year] to [year]"
- Votes: "Vote on [title]: [result]"

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Search results navigable with arrow keys
- Tab order follows visual layout

---

## Examples

### ✅ Good Copy

**Tax Card:**
> Property Tax
> 1.287%
> 4 taxing jurisdictions
> ESTIMATE

**Timeline Event:**
> 2024 Property Tax Levy Adopted
> December 6, 2023 · Effective January 1, 2024
> Minneapolis City Council
> Rate: 0.4246% → 0.4521%
> Vote: Passed (9–4)

**Pending Item:**
> Proposed | FY2025 City Budget
> If adopted as proposed, property tax levy would increase 4.2% over 2024
> Public hearing: December 11, 2024

### ❌ Bad Copy

**Tax Card:**
> Property Tax - GOING UP!
> They raised it to 1.287%
> Blame these 4 jurisdictions

**Timeline Event:**
> Council JACKS UP Your Taxes Again!
> Your representatives voted to take more of your money
> Thanks a lot, 9 council members who voted yes

**Pending Item:**
> WARNING: More Tax Hikes Coming!
> The mayor wants to raise your taxes AGAIN
> This will definitely pass

---

## Implementation Notes

1. **Template Variables:** Use curly braces `{variable}` for dynamic content
2. **Pluralization:** Use ICU format: `{count, plural, one {jurisdiction} other {jurisdictions}}`
3. **Source Attribution:** Every number should have a clickable source link
4. **Consistency:** Use templates exactly—don't paraphrase or "improve" them
5. **Review Process:** All copy changes should be reviewed for neutrality

---

## Reference

See `ui-copy-templates.json` for the complete machine-readable template definitions.
