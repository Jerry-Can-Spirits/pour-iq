-- Optional promotional sale price per drink.
-- Bar managers run happy hour, 2-4-1, or other promo periods; the normal
-- GP% calculation isn't representative during those windows. This lets
-- them store an alternative price so Pour IQ can show 'Promo GP%' next
-- to the standard one.

ALTER TABLE pouriq_cocktails ADD COLUMN promotional_price_p INTEGER;
ALTER TABLE pouriq_cocktails ADD COLUMN promotional_label TEXT;
