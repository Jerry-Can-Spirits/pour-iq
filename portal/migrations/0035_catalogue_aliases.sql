-- Aliases let one canonical catalogue ingredient absorb its brand/synonym
-- spellings (Cointreau↔triple sec, Disaronno↔amaretto, crème de mûre↔
-- blackberry liqueur), so a menu mixing names doesn't create duplicate
-- library entries. Aliases are stored as a JSON array of NORMALISED strings.
ALTER TABLE pouriq_ingredient_catalogue ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]';

-- Aliases on existing rows.
UPDATE pouriq_ingredient_catalogue SET aliases = '["disaronno"]' WHERE normalised_name = 'amaretto';
UPDATE pouriq_ingredient_catalogue SET aliases = '["aromatic bitters"]' WHERE normalised_name = 'angostura bitters';

-- New ingredients the pilot menu needs (deduped against the existing 83).
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, pricing_mode, default_bottle_size_ml, aliases) VALUES
('Blackcurrant Liqueur','blackcurrant liqueur','liqueur','bottle',700,'["crème de cassis","creme de cassis","cassis"]'),
('Blackberry Liqueur','blackberry liqueur','liqueur','bottle',700,'["crème de mûre","creme de mure","mure"]'),
('Passion Fruit Liqueur','passion fruit liqueur','liqueur','bottle',700,'["passoã","passoa"]'),
('Peychauds Bitters','peychauds bitters','liqueur','bottle',150,'["peychaud''s bitters","peychauds"]'),
('Chocolate Bitters','chocolate bitters','liqueur','bottle',150,'[]'),
('Falernum','falernum','syrup','bottle',700,'[]'),
('Maple Syrup','maple syrup','syrup','bottle',1000,'[]'),
('Cream of Coconut','cream of coconut','other','bottle',500,'["coco lopez"]'),
('Coconut Milk','coconut milk','other','bottle',400,'[]'),
('Cherry Puree','cherry puree','juice','bottle',1000,'["cherry purée"]'),
('Hot Sauce','hot sauce','other','bottle',100,'["tabasco"]'),
('Salt','salt','garnish','unit',NULL,'[]'),
('Black Pepper','black pepper','garnish','unit',NULL,'["pepper"]'),
('Celery','celery','garnish','unit',NULL,'[]'),
('Vanilla Ice Cream','vanilla ice cream','other','unit',NULL,'["ice cream"]'),
('Chocolate Ice Cream','chocolate ice cream','other','unit',NULL,'[]');
