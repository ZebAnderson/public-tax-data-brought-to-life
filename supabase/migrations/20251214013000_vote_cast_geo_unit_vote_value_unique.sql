-- TaxAtlas migration: allow multiple vote_values per geo_unit per vote_record (ballot measures)

BEGIN;

DROP INDEX IF EXISTS vote_cast_unique_geo_unit_idx;

CREATE UNIQUE INDEX vote_cast_unique_geo_unit_idx
  ON vote_cast (vote_record_id, voter_geo_unit_id, vote_value)
  WHERE voter_geo_unit_id IS NOT NULL;

COMMIT;

