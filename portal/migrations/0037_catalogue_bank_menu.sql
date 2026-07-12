-- Catalogue completeness from the first real-menu import E2E (The Bank,
-- Blackpool) plus the items Dan flagged as missing. Deduped against the
-- existing 103 rows (0034 seed + 0035 + 0036). Aliases are NORMALISED strings.

-- Named-missing items (chocolate sauce, a combined salt & pepper, sugars).
-- Salt and Black Pepper already exist separately (0035); "Salt & Pepper" is a
-- convenience entry for menus that write the pinch as one (e.g. Bloody Mary).
-- Dry seasonings/sugars are unit-priced (per pinch/spoon), so no ml size.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, pricing_mode, default_bottle_size_ml, aliases) VALUES
('Chocolate Sauce','chocolate sauce','syrup','bottle',1000,'[]'),
('Salt & Pepper','salt & pepper','garnish','unit',NULL,'["salt and pepper"]'),
('Sugar','sugar','other','unit',NULL,'["white sugar","caster sugar","granulated sugar"]'),
('Brown Sugar','brown sugar','other','unit',NULL,'["soft brown sugar"]'),
('Demerara Sugar','demerara sugar','other','unit',NULL,'[]'),
-- Generic categories the Bank menu needs that weren't in the catalogue.
('Passion Fruit Syrup','passion fruit syrup','syrup','bottle',1000,'["passionfruit syrup"]'),
('Coconut Rum','coconut rum','spirit','bottle',700,'["malibu"]'),
('Banana Liqueur','banana liqueur','liqueur','bottle',700,'["crème de banane","creme de banane"]'),
('Raspberry Liqueur','raspberry liqueur','liqueur','bottle',700,'["framboise"]'),
('Worcestershire Sauce','worcestershire sauce','other','bottle',150,'["worcester sauce"]');

-- Synonym/brand aliases so common menu wordings resolve to existing entries
-- instead of creating duplicates.
UPDATE pouriq_ingredient_catalogue SET aliases = '["almond syrup"]' WHERE normalised_name = 'orgeat';
UPDATE pouriq_ingredient_catalogue SET aliases = '["cherry purée","morello cherry puree","morello cherry purée"]' WHERE normalised_name = 'cherry puree';
UPDATE pouriq_ingredient_catalogue SET aliases = '["archers"]' WHERE normalised_name = 'peach schnapps';
UPDATE pouriq_ingredient_catalogue SET aliases = '["bacardi"]' WHERE normalised_name = 'white rum';
UPDATE pouriq_ingredient_catalogue SET aliases = '["kahlua","kahlúa","tia maria"]' WHERE normalised_name = 'coffee liqueur';
