-- Time-of-day window on per-drink promotional pricing (happy hour).
--
-- Builds on the day-of-week / date-range constraints from 0020. Some venues
-- run promos only between certain hours (e.g. after 17:00, or 17:00-19:00),
-- which the day/date constraints couldn't express.
--
-- promotional_start_time / promotional_end_time: "HH:MM" 24-hour, inclusive.
--   NULL start = no lower bound ("until 19:00"); NULL end = no upper bound
--   ("from 17:00"); both NULL = all day (unchanged behaviour).
ALTER TABLE pouriq_cocktails ADD COLUMN promotional_start_time TEXT;
ALTER TABLE pouriq_cocktails ADD COLUMN promotional_end_time TEXT;
