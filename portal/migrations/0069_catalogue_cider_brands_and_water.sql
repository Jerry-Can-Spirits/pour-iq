-- F1: seed Kopparberg/Rekorderlig fruit-cider flavour variants so the import
-- matcher pins them to ingredient_type 'cider' rather than guessing 'gin'.
-- The generic Kopparberg + Rekorderlig rows already exist (0048, retyped by 0051);
-- these are their flavour children. Kopparberg *Gin* variants are NOT touched
-- (kopparberg strawberry & lime gin / kopparberg mixed fruit gin live in 0056 as
-- 'spirit' — correct).
--
-- E3 (seed part): pre-seed a free Water row so it is discoverable when building
-- simple-syrup recipes. Typed as 'mixer' to match soda water / tonic water.
--
-- normalised_name and aliases are lower-case exactly as normalise() produces
-- (apostrophes stripped, diacritics stripped, & kept, whitespace collapsed).

-- Kopparberg fruit-cider flavour variants.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Kopparberg Mixed Fruit','kopparberg mixed fruit','cider','ml',500,'["kopparberg mixed fruit cider"]','cider'),
('Kopparberg Strawberry & Lime','kopparberg strawberry & lime','cider','ml',500,'["kopparberg strawberry and lime","kopparberg strawberry lime"]','cider'),
('Kopparberg Passionfruit','kopparberg passionfruit','cider','ml',500,'["kopparberg passion fruit"]','cider'),
('Kopparberg Wild Berries','kopparberg wild berries','cider','ml',500,'[]','cider'),
('Kopparberg Pear','kopparberg pear','cider','ml',500,'[]','cider'),
('Kopparberg Cherry','kopparberg cherry','cider','ml',500,'[]','cider');

-- Rekorderlig fruit-cider flavour variants.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Rekorderlig Strawberry & Lime','rekorderlig strawberry & lime','cider','ml',500,'["rekorderlig strawberry and lime","rekorderlig strawberry lime"]','cider'),
('Rekorderlig Wild Berries','rekorderlig wild berries','cider','ml',500,'[]','cider');

-- Free Water ingredient (for simple-syrup recipe construction etc.).
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Water','water','mixer','ml',NULL,'["still water","tap water"]',NULL);
