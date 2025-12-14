-- TaxAtlas migration 0002
-- Fix ballot/geo-unit vote storage to allow multiple vote_values per geo_unit per vote_record.
--
-- Previous schema had a unique index on (vote_record_id, voter_geo_unit_id) which prevents storing
-- both "yes" and "no" tallies for the same geo_unit. The intended model stores one row per
-- (vote_record_id, geo_unit, vote_value) with weight = count (or other measure).

BEGIN;

DROP INDEX IF EXISTS vote_cast_unique_geo_unit_idx;

CREATE UNIQUE INDEX vote_cast_unique_geo_unit_idx
  ON vote_cast (vote_record_id, voter_geo_unit_id, vote_value)
  WHERE voter_geo_unit_id IS NOT NULL;

COMMIT;

-- DOWN (manual):
-- BEGIN;
-- DROP INDEX IF EXISTS vote_cast_unique_geo_unit_idx;
-- CREATE UNIQUE INDEX vote_cast_unique_geo_unit_idx
--   ON vote_cast (vote_record_id, voter_geo_unit_id)
--   WHERE voter_geo_unit_id IS NOT NULL;
-- COMMIT;

