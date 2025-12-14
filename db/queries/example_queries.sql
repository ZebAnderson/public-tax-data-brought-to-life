-- TaxAtlas example queries (parameterized)
--
-- Conventions:
-- - :alias_text, :state_code, :geo_unit_id, :methodology_version_id are placeholders.
-- - In psql you can use \set alias_text 'Seattle' etc.

-- a) Resolve alias -> geo_unit (fast exact match; optionally scoped by state)
SELECT
  gu.geo_unit_id,
  gu.geo_unit_type,
  gu.geoid,
  gu.name,
  gu.state_code,
  pa.alias_text::text AS matched_alias,
  pa.alias_kind,
  pa.alias_rank,
  pa.is_preferred
FROM place_alias pa
JOIN geo_unit gu ON gu.geo_unit_id = pa.geo_unit_id
WHERE pa.alias_text = :alias_text
  AND (:state_code IS NULL OR pa.state_code = :state_code)
ORDER BY
  (pa.state_code = :state_code) DESC NULLS LAST,
  pa.is_preferred DESC,
  pa.alias_rank DESC
LIMIT 10;

-- b) Get jurisdictions for geo_unit (ranked by coverage_ratio)
SELECT
  j.jurisdiction_id,
  j.jurisdiction_type,
  j.name,
  guj.coverage_ratio,
  guj.coverage_area_m2
FROM geo_unit_jurisdiction guj
JOIN jurisdiction j ON j.jurisdiction_id = guj.jurisdiction_id
WHERE guj.geo_unit_id = :geo_unit_id
  AND guj.methodology_version_id = :methodology_version_id
ORDER BY guj.coverage_ratio DESC, j.jurisdiction_type, j.name;

-- c) Get "current tax cards" for geo_unit (latest snapshots per applicable instrument)
WITH applicable_jurisdictions AS (
  SELECT guj.jurisdiction_id, guj.coverage_ratio
  FROM geo_unit_jurisdiction guj
  WHERE guj.geo_unit_id = :geo_unit_id
    AND guj.methodology_version_id = :methodology_version_id
    AND guj.coverage_ratio > 0
),
applicable_instruments AS (
  SELECT
    ti.tax_instrument_id,
    ti.jurisdiction_id,
    ti.tax_type,
    ti.name AS instrument_name,
    aj.coverage_ratio
  FROM tax_instrument ti
  JOIN applicable_jurisdictions aj ON aj.jurisdiction_id = ti.jurisdiction_id
  WHERE ti.is_active
)
SELECT
  ai.tax_instrument_id,
  ai.tax_type,
  ai.instrument_name,
  j.name AS jurisdiction_name,
  j.jurisdiction_type,
  ai.coverage_ratio,
  trs.effective_date AS rate_effective_date,
  trs.tax_year AS rate_tax_year,
  trs.rate_value,
  trs.rate_unit,
  trs.rate_brackets,
  pt.tax_year AS property_tax_year,
  pt.levy_amount,
  pt.taxable_value_amount,
  pt.median_bill_amount
FROM applicable_instruments ai
JOIN jurisdiction j ON j.jurisdiction_id = ai.jurisdiction_id
LEFT JOIN LATERAL (
  SELECT trs.*
  FROM tax_rate_snapshot trs
  WHERE trs.tax_instrument_id = ai.tax_instrument_id
    AND trs.methodology_version_id = :methodology_version_id
    AND trs.effective_date <= CURRENT_DATE
    AND (trs.end_date IS NULL OR trs.end_date > CURRENT_DATE)
  ORDER BY trs.effective_date DESC
  LIMIT 1
) trs ON true
LEFT JOIN LATERAL (
  SELECT pt.*
  FROM property_tax_context_snapshot pt
  WHERE pt.geo_unit_id = :geo_unit_id
    AND pt.tax_instrument_id = ai.tax_instrument_id
    AND pt.methodology_version_id = :methodology_version_id
  ORDER BY pt.tax_year DESC
  LIMIT 1
) pt ON ai.tax_type = 'property'::taxatlas_tax_type
ORDER BY ai.tax_type, j.jurisdiction_type, j.name, ai.instrument_name;

-- d) Accountability timeline: property-tax decisions last 10 years (decisions + votes + officials)
WITH params AS (
  SELECT
    :geo_unit_id::uuid AS geo_unit_id,
    :methodology_version_id::uuid AS methodology_version_id,
    (CURRENT_DATE - INTERVAL '10 years')::date AS since_date
),
applicable_jurisdictions AS (
  SELECT guj.jurisdiction_id, guj.coverage_ratio
  FROM geo_unit_jurisdiction guj
  JOIN params p ON true
  WHERE guj.geo_unit_id = p.geo_unit_id
    AND guj.methodology_version_id = p.methodology_version_id
    AND guj.coverage_ratio > 0
),
property_instruments AS (
  SELECT ti.tax_instrument_id, ti.jurisdiction_id
  FROM tax_instrument ti
  JOIN applicable_jurisdictions aj ON aj.jurisdiction_id = ti.jurisdiction_id
  WHERE ti.tax_type = 'property'::taxatlas_tax_type
    AND ti.is_active
),
relevant_events AS (
  SELECT DISTINCT de.decision_event_id
  FROM decision_event de
  JOIN decision_tax_impact dti ON dti.decision_event_id = de.decision_event_id
  JOIN property_instruments pi ON pi.tax_instrument_id = dti.tax_instrument_id
  JOIN params p ON true
  WHERE de.event_date >= p.since_date
    AND dti.methodology_version_id = p.methodology_version_id
)
SELECT
  de.decision_event_id,
  de.event_date,
  de.event_type,
  de.title,
  de.summary,
  j.jurisdiction_id,
  j.jurisdiction_type,
  j.name AS jurisdiction_name,
  sd.url AS source_url,
  impacts.impacts,
  votes.vote_records,
  votes.roll_call_votes,
  votes.ballot_results_for_geo_unit,
  officials.officials
FROM relevant_events re
JOIN decision_event de ON de.decision_event_id = re.decision_event_id
JOIN jurisdiction j ON j.jurisdiction_id = de.jurisdiction_id
JOIN source_doc sd ON sd.source_doc_id = de.source_doc_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'tax_instrument_id', dti.tax_instrument_id,
      'impact_direction', dti.impact_direction,
      'tax_year', dti.tax_year,
      'delta_rate_value', dti.delta_rate_value,
      'delta_revenue_amount', dti.delta_revenue_amount,
      'delta_description', dti.delta_description
    )
    ORDER BY dti.tax_year DESC NULLS LAST, dti.impact_direction
  ) AS impacts
  FROM decision_tax_impact dti
  JOIN property_instruments pi ON pi.tax_instrument_id = dti.tax_instrument_id
  JOIN params p ON true
  WHERE dti.decision_event_id = de.decision_event_id
    AND dti.methodology_version_id = p.methodology_version_id
) impacts ON true
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'vote_record_id', vr.vote_record_id,
        'vote_type', vr.vote_type,
        'vote_date', vr.vote_date,
        'passed', vr.passed,
        'yes_count', vr.yes_count,
        'no_count', vr.no_count,
        'abstain_count', vr.abstain_count,
        'absent_count', vr.absent_count,
        'question', vr.question
      )
    ) FILTER (WHERE vr.vote_record_id IS NOT NULL) AS vote_records,
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'person_id', p.person_id,
        'full_name', p.full_name,
        'office_id', o.office_id,
        'office_name', o.office_name,
        'vote_value', vc.vote_value,
        'weight', vc.weight
      )
    ) FILTER (WHERE vc.vote_cast_id IS NOT NULL AND vc.voter_person_id IS NOT NULL) AS roll_call_votes,
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'vote_value', vc.vote_value,
        'weight', vc.weight
      )
    ) FILTER (WHERE vc.vote_cast_id IS NOT NULL AND vc.voter_geo_unit_id = :geo_unit_id::uuid) AS ballot_results_for_geo_unit
  FROM vote_record vr
  LEFT JOIN vote_cast vc ON vc.vote_record_id = vr.vote_record_id
  LEFT JOIN person p ON p.person_id = vc.voter_person_id
  LEFT JOIN term t
    ON t.person_id = p.person_id
   AND t.start_date <= vr.vote_date
   AND (t.end_date IS NULL OR t.end_date >= vr.vote_date)
  LEFT JOIN office o
    ON o.office_id = t.office_id
   AND o.jurisdiction_id = de.jurisdiction_id
  WHERE vr.decision_event_id = de.decision_event_id
) votes ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    DISTINCT jsonb_build_object(
      'person_id', p.person_id,
      'full_name', p.full_name,
      'office_id', o.office_id,
      'office_name', o.office_name,
      'term_start', t.start_date,
      'term_end', t.end_date
    )
    ORDER BY o.office_name, p.full_name
  ) AS officials
  FROM office o
  JOIN term t ON t.office_id = o.office_id
  JOIN person p ON p.person_id = t.person_id
  WHERE o.jurisdiction_id = de.jurisdiction_id
    AND t.start_date <= de.event_date
    AND (t.end_date IS NULL OR t.end_date >= de.event_date)
) officials ON true
ORDER BY de.event_date DESC;

-- ============================================================================
-- PAYROLL TAX QUERIES (Added for Migration 0003)
-- ============================================================================

-- e) Fetch payroll instruments applicable in Minnesota
-- Returns all payroll tax instruments (federal + state) that apply to MN workers
SELECT
  ti.tax_instrument_id,
  ti.name AS instrument_name,
  ti.description,
  j.jurisdiction_id,
  j.name AS jurisdiction_name,
  j.jurisdiction_type,
  j.state_code,
  ti.metadata->>'payroll_category' AS payroll_category,
  ti.metadata->>'display_order' AS display_order,
  ti.metadata->>'employee_visible' AS employee_visible,
  ti.metadata->>'employer_visible' AS employer_visible,
  ti.metadata->>'microcopy' AS microcopy,
  sd.is_demo,
  sd.url AS source_url
FROM tax_instrument ti
JOIN jurisdiction j ON j.jurisdiction_id = ti.jurisdiction_id
JOIN source_doc sd ON sd.source_doc_id = ti.source_doc_id
WHERE ti.tax_type = 'payroll'::taxatlas_tax_type
  AND ti.is_active = true
  AND (
    j.jurisdiction_type = 'federal'::taxatlas_jurisdiction_type
    OR j.state_code = 'MN'
  )
ORDER BY
  (ti.metadata->>'display_order')::int NULLS LAST,
  j.jurisdiction_type,
  ti.name;

-- f) Get current payroll tax rates for Minnesota (tax year 2024)
-- Returns detailed rate information for all applicable payroll taxes
SELECT
  pts.payroll_tax_snapshot_id,
  ti.name AS instrument_name,
  j.name AS jurisdiction_name,
  j.jurisdiction_type,
  pts.payroll_category,
  pts.payer_type,
  pts.tax_year,
  pts.employee_rate,
  pts.employer_rate,
  pts.self_employed_rate,
  pts.wage_base_limit,
  pts.wage_floor,
  pts.thresholds,
  pts.metadata->>'display_name' AS display_name,
  pts.metadata->>'applies_to' AS applies_to,
  pts.metadata->>'notes' AS notes,
  sd.is_demo,
  sd.url AS source_url
FROM payroll_tax_snapshot pts
JOIN tax_instrument ti ON ti.tax_instrument_id = pts.tax_instrument_id
JOIN jurisdiction j ON j.jurisdiction_id = ti.jurisdiction_id
JOIN source_doc sd ON sd.source_doc_id = pts.source_doc_id
WHERE ti.tax_type = 'payroll'::taxatlas_tax_type
  AND ti.is_active = true
  AND pts.tax_year = :tax_year  -- e.g., 2024
  AND pts.effective_date <= CURRENT_DATE
  AND (pts.end_date IS NULL OR pts.end_date > CURRENT_DATE)
  AND (
    j.jurisdiction_type = 'federal'::taxatlas_jurisdiction_type
    OR j.state_code = 'MN'
  )
ORDER BY
  pts.payroll_category,
  j.jurisdiction_type,
  pts.payer_type;

-- g) Compute payroll tax totals from a given wages_annual
-- This is a sample calculation query; production would use methodology rules
-- Parameters: :wages_annual (e.g., 150000), :tax_year (e.g., 2024)
WITH params AS (
  SELECT
    :wages_annual::numeric AS wages_annual,
    :tax_year::smallint AS tax_year
),
payroll_rates AS (
  SELECT
    pts.payroll_category,
    pts.payer_type,
    ti.name AS instrument_name,
    j.name AS jurisdiction_name,
    pts.employee_rate,
    pts.employer_rate,
    pts.self_employed_rate,
    pts.wage_base_limit,
    pts.wage_floor,
    pts.thresholds,
    pts.metadata
  FROM payroll_tax_snapshot pts
  JOIN tax_instrument ti ON ti.tax_instrument_id = pts.tax_instrument_id
  JOIN jurisdiction j ON j.jurisdiction_id = ti.jurisdiction_id
  JOIN params p ON pts.tax_year = p.tax_year
  WHERE ti.tax_type = 'payroll'::taxatlas_tax_type
    AND ti.is_active = true
    AND pts.effective_date <= CURRENT_DATE
    AND (pts.end_date IS NULL OR pts.end_date > CURRENT_DATE)
    AND (
      j.jurisdiction_type = 'federal'::taxatlas_jurisdiction_type
      OR j.state_code = 'MN'
    )
),
calculated_taxes AS (
  SELECT
    pr.payroll_category,
    pr.payer_type,
    pr.instrument_name,
    pr.jurisdiction_name,
    pr.employee_rate,
    pr.employer_rate,
    pr.wage_base_limit,
    pr.wage_floor,
    p.wages_annual,
    -- Taxable wages (capped at wage base if applicable)
    CASE
      WHEN pr.wage_base_limit IS NOT NULL THEN LEAST(p.wages_annual, pr.wage_base_limit)
      ELSE p.wages_annual
    END AS taxable_wages,
    -- Employee amount
    CASE
      WHEN pr.employee_rate IS NOT NULL THEN
        pr.employee_rate * CASE
          WHEN pr.wage_base_limit IS NOT NULL THEN LEAST(p.wages_annual, pr.wage_base_limit)
          ELSE p.wages_annual
        END
      ELSE 0
    END AS employee_amount,
    -- Employer amount
    CASE
      WHEN pr.employer_rate IS NOT NULL THEN
        pr.employer_rate * CASE
          WHEN pr.wage_base_limit IS NOT NULL THEN LEAST(p.wages_annual, pr.wage_base_limit)
          ELSE p.wages_annual
        END
      ELSE 0
    END AS employer_amount
  FROM payroll_rates pr
  CROSS JOIN params p
  WHERE pr.wage_floor IS NULL OR p.wages_annual > pr.wage_floor
)
SELECT
  ct.payroll_category,
  ct.payer_type,
  ct.instrument_name,
  ct.jurisdiction_name,
  ct.wages_annual,
  ct.taxable_wages,
  ct.employee_rate,
  ct.employer_rate,
  ROUND(ct.employee_amount, 2) AS employee_amount,
  ROUND(ct.employer_amount, 2) AS employer_amount,
  ROUND(ct.employee_amount + ct.employer_amount, 2) AS total_amount
FROM calculated_taxes ct
ORDER BY ct.payroll_category, ct.payer_type;

-- h) Summary: Total payroll burden for W-2 worker in Minnesota
-- Parameters: :wages_annual (e.g., 150000), :tax_year (e.g., 2024)
WITH params AS (
  SELECT
    :wages_annual::numeric AS wages_annual,
    :tax_year::smallint AS tax_year
),
payroll_rates AS (
  SELECT
    pts.payroll_category,
    pts.payer_type,
    ti.name AS instrument_name,
    pts.employee_rate,
    pts.employer_rate,
    pts.wage_base_limit,
    pts.wage_floor,
    pts.thresholds
  FROM payroll_tax_snapshot pts
  JOIN tax_instrument ti ON ti.tax_instrument_id = pts.tax_instrument_id
  JOIN jurisdiction j ON j.jurisdiction_id = ti.jurisdiction_id
  JOIN params p ON pts.tax_year = p.tax_year
  WHERE ti.tax_type = 'payroll'::taxatlas_tax_type
    AND ti.is_active = true
    AND pts.effective_date <= CURRENT_DATE
    AND (pts.end_date IS NULL OR pts.end_date > CURRENT_DATE)
    AND (
      j.jurisdiction_type = 'federal'::taxatlas_jurisdiction_type
      OR j.state_code = 'MN'
    )
),
calculated AS (
  SELECT
    pr.payroll_category,
    pr.payer_type,
    p.wages_annual,
    -- Employee portion
    CASE
      WHEN pr.employee_rate IS NOT NULL THEN
        pr.employee_rate * CASE
          WHEN pr.wage_base_limit IS NOT NULL THEN LEAST(p.wages_annual, pr.wage_base_limit)
          ELSE p.wages_annual
        END
      ELSE 0
    END AS employee_amount,
    -- Employer portion
    CASE
      WHEN pr.employer_rate IS NOT NULL THEN
        pr.employer_rate * CASE
          WHEN pr.wage_base_limit IS NOT NULL THEN LEAST(p.wages_annual, pr.wage_base_limit)
          ELSE p.wages_annual
        END
      ELSE 0
    END AS employer_amount
  FROM payroll_rates pr
  CROSS JOIN params p
  WHERE pr.wage_floor IS NULL OR p.wages_annual > pr.wage_floor
)
SELECT
  p.wages_annual,
  p.tax_year,
  ROUND(SUM(c.employee_amount), 2) AS total_employee_paid,
  ROUND(SUM(c.employer_amount), 2) AS total_employer_paid,
  ROUND(SUM(c.employee_amount) + SUM(c.employer_amount), 2) AS total_payroll_burden,
  ROUND((SUM(c.employee_amount) / p.wages_annual) * 100, 2) AS employee_effective_rate_pct,
  ROUND((SUM(c.employer_amount) / p.wages_annual) * 100, 2) AS employer_effective_rate_pct,
  ROUND(((SUM(c.employee_amount) + SUM(c.employer_amount)) / p.wages_annual) * 100, 2) AS total_effective_rate_pct
FROM calculated c
CROSS JOIN params p
GROUP BY p.wages_annual, p.tax_year;

-- i) Additional Medicare Tax calculation (for high earners)
-- Parameters: :wages_annual (e.g., 250000), :filing_status ('single', 'married_joint', 'married_separate')
WITH params AS (
  SELECT
    :wages_annual::numeric AS wages_annual,
    :filing_status::text AS filing_status
),
additional_medicare AS (
  SELECT
    pts.employee_rate AS additional_rate,
    CASE
      WHEN p.filing_status = 'single' THEN (pts.thresholds->>'single_threshold')::numeric
      WHEN p.filing_status = 'married_joint' THEN (pts.thresholds->>'married_joint_threshold')::numeric
      WHEN p.filing_status = 'married_separate' THEN (pts.thresholds->>'married_separate_threshold')::numeric
      ELSE 200000  -- Default to single threshold
    END AS threshold
  FROM payroll_tax_snapshot pts
  JOIN tax_instrument ti ON ti.tax_instrument_id = pts.tax_instrument_id
  JOIN params p ON true
  WHERE ti.name = 'Additional Medicare Tax'
    AND pts.tax_year = EXTRACT(YEAR FROM CURRENT_DATE)::smallint
    AND pts.effective_date <= CURRENT_DATE
    AND (pts.end_date IS NULL OR pts.end_date > CURRENT_DATE)
)
SELECT
  p.wages_annual,
  p.filing_status,
  am.threshold,
  am.additional_rate,
  CASE
    WHEN p.wages_annual > am.threshold
    THEN ROUND((p.wages_annual - am.threshold) * am.additional_rate, 2)
    ELSE 0
  END AS additional_medicare_tax
FROM params p
CROSS JOIN additional_medicare am;
