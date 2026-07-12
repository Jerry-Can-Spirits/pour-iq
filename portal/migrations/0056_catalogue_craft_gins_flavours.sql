-- Craft/flavoured gins + Antica Sambuca, surfaced by a real venue's menu import.
-- Additive; normalised_name and aliases lower-case exactly as normalise() produces
-- (apostrophes stripped, accents and & kept). Flavoured gin brands typed as
-- 'spirit' (they are full-ABV gins); Edinburgh Gin liqueur expressions typed as
-- 'liqueur' (pre-diluted, lower ABV). Zymurgorium expressions typed as 'liqueur'.
-- Antica Sambuca typed as 'liqueur' with the aniseed-liqueur generic.

INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Jawbox Classic Dry Gin','jawbox classic dry gin','spirit','ml',700,'["jawbox"]','gin'),
('Whitley Neill Rhubarb & Ginger','whitley neill rhubarb & ginger','spirit','ml',700,'[]','gin'),
('Whitley Neill Blood Orange','whitley neill blood orange','spirit','ml',700,'[]','gin'),
('Whitley Neill Raspberry','whitley neill raspberry','spirit','ml',700,'[]','gin'),
('Whitley Neill Parma Violet','whitley neill parma violet','spirit','ml',700,'[]','gin'),
('Edinburgh Gin Rhubarb & Ginger','edinburgh gin rhubarb & ginger','spirit','ml',700,'["edinburgh rhubarb and ginger"]','gin'),
('Edinburgh Gin Elderflower','edinburgh gin elderflower','liqueur','ml',500,'["edinburgh elderflower"]','elderflower liqueur'),
('Edinburgh Gin Raspberry','edinburgh gin raspberry','liqueur','ml',500,'["edinburgh raspberry"]',NULL),
('Persian Blue Gin','persian blue gin','spirit','ml',700,'["persian blue"]','gin'),
('Kopparberg Strawberry & Lime Gin','kopparberg strawberry & lime gin','spirit','ml',700,'["kopparberg strawberry and lime gin"]','gin'),
('Kopparberg Mixed Fruit Gin','kopparberg mixed fruit gin','spirit','ml',700,'[]','gin'),
('Zymurgorium Sweet Violet Gin','zymurgorium sweet violet gin','liqueur','ml',500,'["zymurgorium sweet violet"]',NULL),
('Zymurgorium Strawberry & Mint','zymurgorium strawberry & mint','liqueur','ml',500,'[]',NULL),
('Antica Sambuca','antica sambuca','liqueur','ml',700,'["antica sambuca classic"]','aniseed liqueur');
