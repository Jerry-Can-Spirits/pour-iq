-- Day-of-week and date-range constraints on per-drink promotional pricing.
--
-- Builds on the promotional_price_p / promotional_label columns added in
-- 0018. Until this migration, a configured promo was "always on" and the
-- promo column on the menu detail page showed it permanently. With these
-- constraints, bar managers can tag promos to specific days of the week
-- (e.g. Wednesdays) and/or date windows (e.g. February 14 only).
--
-- promotional_days: CSV of day numbers (0=Sun .. 6=Sat). NULL = every day.
--   Examples: "3" = Wednesdays only, "1,2,3,4,5" = Mon-Fri.
-- promotional_valid_from / promotional_valid_until: ISO YYYY-MM-DD,
--   inclusive. NULL on either side means no boundary in that direction.

ALTER TABLE pouriq_cocktails ADD COLUMN promotional_days TEXT;
ALTER TABLE pouriq_cocktails ADD COLUMN promotional_valid_from TEXT;
ALTER TABLE pouriq_cocktails ADD COLUMN promotional_valid_until TEXT;
