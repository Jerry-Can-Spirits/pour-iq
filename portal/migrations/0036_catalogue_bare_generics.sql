-- Bare generic spirits, so a recipe that just says "gin" / "rum" / "whisky"
-- / "tequila" matches the catalogue (the specific variants — London Dry Gin,
-- Dark Rum, etc. — remain for menus that name them). Vodka and Brandy bare
-- generics already exist. Plus common vermouth synonyms.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, pricing_mode, default_bottle_size_ml, aliases) VALUES
('Gin','gin','spirit','bottle',700,'[]'),
('Rum','rum','spirit','bottle',700,'[]'),
('Whisky','whisky','spirit','bottle',700,'["whiskey"]'),
('Tequila','tequila','spirit','bottle',700,'[]');

UPDATE pouriq_ingredient_catalogue SET aliases = '["rosso vermouth","red vermouth","vermouth rosso"]' WHERE normalised_name = 'sweet vermouth';
UPDATE pouriq_ingredient_catalogue SET aliases = '["white vermouth","vermouth dry"]' WHERE normalised_name = 'dry vermouth';
