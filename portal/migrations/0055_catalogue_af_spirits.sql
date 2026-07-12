-- AF spirits/aperitifs + Havana Club Spiced, from a real venue's spirits/AF
-- section. The catalogue had AF beers but no AF spirits/aperitifs. Additive;
-- normalised_name/aliases lower-case exactly as normalise() produces (apostrophes
-- stripped, accents/& kept). 'alcohol-free' type already allowed (migration 0051).

-- New AF generics.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Alcohol-Free Gin','alcohol-free gin','alcohol-free','ml',700,'["af gin","non alcoholic gin","zero gin"]',NULL),
('Alcohol-Free Rum','alcohol-free rum','alcohol-free','ml',700,'["af rum","non alcoholic rum","zero rum"]',NULL),
('Alcohol-Free Aperitif','alcohol-free aperitif','alcohol-free','ml',500,'["af aperitif","non alcoholic aperitif"]',NULL);

-- Brands.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Havana Club Spiced','havana club spiced','spirit','ml',700,'["havana club spiced rum"]','spiced rum'),
('Clean G','clean g','alcohol-free','ml',700,'["cleanco clean g"]','alcohol-free gin'),
('Clean R','clean r','alcohol-free','ml',700,'["cleanco clean r"]','alcohol-free rum'),
('Everleaf Forest','everleaf forest','alcohol-free','ml',500,'[]','alcohol-free aperitif'),
('Everleaf Mountain','everleaf mountain','alcohol-free','ml',500,'[]','alcohol-free aperitif'),
('Everleaf Marine','everleaf marine','alcohol-free','ml',500,'[]','alcohol-free aperitif');
