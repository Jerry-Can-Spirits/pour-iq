-- More on-trade brands flagged during real-invoice testing (menu pages 1-3):
-- Old J (the house spiced rum in many UK bars, plus its overproof Tiki Fire),
-- Cockburn's Port, Tio Pepe (fino sherry), Gentleman Jack, Vecchia Romagna.
-- Adds 'port' and 'sherry' generics (no fortified-wine generic existed; the
-- existing wine rows are still/sparkling only). Additive only; normalised_name
-- and aliases are lower-case exactly as normalise() produces them (apostrophes
-- stripped, accents kept).

-- New generics for fortified wine.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Port','port','wine','ml',750,'["ruby port","tawny port"]',NULL),
('Sherry','sherry','wine','ml',750,'["fino","fino sherry","amontillado","oloroso","cream sherry"]',NULL);

-- Brands.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Old J Spiced','old j spiced','spirit','ml',700,'["old j","old j spiced rum"]','spiced rum'),
('Old J Tiki Fire','old j tiki fire','spirit','ml',700,'["tiki fire"]','overproof rum'),
('Cockburn''s','cockburns','wine','ml',750,'["cockburns port"]','port'),
('Tio Pepe','tio pepe','wine','ml',750,'["tio pepe fino"]','sherry'),
('Gentleman Jack','gentleman jack','spirit','ml',700,'["gentleman jack daniels"]','whisky'),
('Vecchia Romagna','vecchia romagna','spirit','ml',700,'["vecchia romagna brandy"]','brandy');
