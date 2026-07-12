-- Catalogue: add 'cider' and 'alcohol-free' ingredient types, retype existing
-- ciders off 'beer', and expand the brand/generic coverage for UK on-trade so
-- venues do far less manual entry on import.
--
-- The catalogue is curated cross-tenant reference data with no inbound FKs
-- (adoption COPIES a match into the tenant library; nothing writes back), but
-- SQLite cannot ALTER a CHECK, so the type-CHECK widening is a table rebuild
-- preserving all rows + the 0048 `generic` column. The tenant library table
-- (0043) has no ingredient_type CHECK, so it already accepts the new types.
--
-- normalised_name + every alias are lower-case and stored exactly as normalise()
-- produces them (it keeps accents and "&"); the accent-free / spelled-out
-- variant is listed as an alias so both forms match.

-- 1. Rebuild with the widened ingredient_type CHECK (adds 'cider','alcohol-free').
CREATE TABLE pouriq_ingredient_catalogue_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  normalised_name TEXT NOT NULL UNIQUE,
  ingredient_type TEXT NOT NULL CHECK (ingredient_type IN
    ('spirit','liqueur','wine','beer','cider','mixer','syrup','juice','garnish','soft-drink','alcohol-free','food','other')),
  base_unit TEXT NOT NULL CHECK (base_unit IN ('ml','g','each')),
  default_pack_size REAL,
  aliases TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 1,
  contributor_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  generic TEXT
);

INSERT INTO pouriq_ingredient_catalogue_new
  (id, name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, verified, contributor_count, created_at, updated_at, generic)
  SELECT id, name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, verified, contributor_count, created_at, updated_at, generic
  FROM pouriq_ingredient_catalogue;

DROP TABLE pouriq_ingredient_catalogue;
ALTER TABLE pouriq_ingredient_catalogue_new RENAME TO pouriq_ingredient_catalogue;

-- 2. Retype existing ciders (the generic + the brands linked to it) off 'beer'.
UPDATE pouriq_ingredient_catalogue
  SET ingredient_type = 'cider', updated_at = datetime('now')
  WHERE normalised_name = 'cider' OR generic = 'cider';

-- 3. New generics.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
('Bitter','bitter','beer','ml',500,'["smooth","best bitter"]',NULL),
('Pale Ale','pale ale','beer','ml',330,'["amber ale"]',NULL),
('Wheat Beer','wheat beer','beer','ml',330,'["weissbier","witbier","wheat ale"]',NULL),
('Alcohol-Free Beer','alcohol-free beer','alcohol-free','ml',330,'["af beer","non alcoholic beer","low alcohol beer","zero beer"]',NULL),
('Alcopop','alcopop','other','ml',275,'["rtd","ready to drink"]',NULL),
('Whisky Liqueur','whisky liqueur','liqueur','ml',700,'[]',NULL),
('Herbal Liqueur','herbal liqueur','liqueur','ml',700,'["digestif"]',NULL),
('Aniseed Liqueur','aniseed liqueur','liqueur','ml',700,'["sambuca","ouzo","pastis"]',NULL),
('Energy Drink','energy drink','soft-drink','ml',250,'["energy"]',NULL);

-- 4. New brands.
INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
-- Lager
('Budweiser','budweiser','beer','ml',330,'["bud"]','lager'),
('Corona','corona','beer','ml',330,'["corona extra"]','lager'),
('Beck''s','becks','beer','ml',330,'[]','lager'),
('Kronenbourg 1664','kronenbourg 1664','beer','ml',330,'["kronenbourg","1664"]','lager'),
('Tiger','tiger','beer','ml',330,'["tiger beer"]','lager'),
('Sol','sol','beer','ml',330,'[]','lager'),
('Modelo','modelo','beer','ml',330,'["modelo especial"]','lager'),
('Tsingtao','tsingtao','beer','ml',330,'[]','lager'),
('Singha','singha','beer','ml',330,'[]','lager'),
('Pravha','pravha','beer','ml',330,'[]','lager'),
('Staropramen','staropramen','beer','ml',330,'[]','lager'),
('Red Stripe','red stripe','beer','ml',330,'[]','lager'),
('Desperados','desperados','beer','ml',330,'[]','lager'),
-- Bitter / smooth
('John Smith''s Extra Smooth','john smiths extra smooth','beer','ml',440,'["john smiths","john smith","extra smooth"]','bitter'),
('Tetley''s','tetleys','beer','ml',440,'["tetleys smooth"]','bitter'),
('Boddingtons','boddingtons','beer','ml',440,'[]','bitter'),
-- Ales (standalone)
('London Pride','london pride','beer','ml',500,'["fullers london pride"]',NULL),
('Abbot Ale','abbot ale','beer','ml',500,'[]',NULL),
('Spitfire','spitfire','beer','ml',500,'[]',NULL),
('Bombardier','bombardier','beer','ml',500,'[]',NULL),
('Timothy Taylor Landlord','timothy taylor landlord','beer','ml',500,'["landlord"]',NULL),
('Wainwright','wainwright','beer','ml',500,'[]',NULL),
('Black Sheep','black sheep','beer','ml',500,'[]',NULL),
('Theakston Old Peculier','theakston old peculier','beer','ml',500,'["old peculier"]',NULL),
-- Stout
('Murphy''s','murphys','beer','ml',440,'["murphys stout"]','stout'),
('Beamish','beamish','beer','ml',440,'[]','stout'),
-- IPA
('Punk IPA','punk ipa','beer','ml',330,'["brewdog punk ipa","brewdog punk"]','ipa'),
('Goose Island IPA','goose island ipa','beer','ml',355,'["goose island"]','ipa'),
('Lagunitas IPA','lagunitas ipa','beer','ml',355,'["lagunitas"]','ipa'),
-- Pale ale
('Beavertown Gamma Ray','beavertown gamma ray','beer','ml',330,'["gamma ray"]','pale ale'),
-- Wheat beer
('Hoegaarden','hoegaarden','beer','ml',330,'[]','wheat beer'),
('Erdinger','erdinger','beer','ml',500,'[]','wheat beer'),
('Blue Moon','blue moon','beer','ml',330,'[]','wheat beer'),
('Franziskaner','franziskaner','beer','ml',500,'[]','wheat beer'),
-- Cider
('Bulmers','bulmers','cider','ml',500,'["bulmers original"]','cider'),
('Old Mout','old mout','cider','ml',500,'["old mout cider"]','cider'),
('Stowford Press','stowford press','cider','ml',500,'["westons stowford press"]','cider'),
('Henry Westons','henry westons','cider','ml',500,'["westons","henry westons vintage"]','cider'),
('Brothers','brothers','cider','ml',500,'["brothers cider"]','cider'),
('Angry Orchard','angry orchard','cider','ml',355,'[]','cider'),
('Savanna','savanna','cider','ml',330,'["savanna dry"]','cider'),
-- Alcohol-free
('Beck''s Blue','becks blue','alcohol-free','ml',330,'["becks blue alcohol free"]','alcohol-free beer'),
('Heineken 0.0','heineken 0.0','alcohol-free','ml',330,'["heineken zero","heineken 00"]','alcohol-free beer'),
('Guinness 0.0','guinness 0.0','alcohol-free','ml',440,'["guinness zero"]','alcohol-free beer'),
('Lucky Saint','lucky saint','alcohol-free','ml',330,'[]','alcohol-free beer'),
('Peroni Libera','peroni libera','alcohol-free','ml',330,'["peroni 0.0","peroni zero"]','alcohol-free beer'),
('BrewDog Nanny State','brewdog nanny state','alcohol-free','ml',330,'["nanny state"]','alcohol-free beer'),
('San Miguel 0.0','san miguel 0.0','alcohol-free','ml',330,'["san miguel zero"]','alcohol-free beer'),
-- Alcopop / RTD
('Smirnoff Ice','smirnoff ice','other','ml',275,'[]','alcopop'),
('WKD Blue','wkd blue','other','ml',275,'["wkd"]','alcopop'),
('VK','vk','other','ml',275,'["vk blue","vodka kick"]','alcopop'),
('Bacardi Breezer','bacardi breezer','other','ml',275,'["breezer"]','alcopop'),
-- Whisky liqueur
('Drambuie','drambuie','liqueur','ml',700,'[]','whisky liqueur'),
('Southern Comfort','southern comfort','liqueur','ml',700,'["soco"]','whisky liqueur'),
-- Herbal / aniseed liqueur
('Jägermeister','jägermeister','liqueur','ml',700,'["jagermeister","jager"]','herbal liqueur'),
('Fernet-Branca','fernet-branca','liqueur','ml',700,'["fernet","fernet branca"]','herbal liqueur'),
('Ouzo','ouzo','liqueur','ml',700,'[]','aniseed liqueur'),
('Pernod','pernod','liqueur','ml',700,'["pastis"]','aniseed liqueur'),
-- Liqueur brands (proper rows for products previously only aliased)
('Baileys','baileys','liqueur','ml',700,'["baileys irish cream"]','irish cream'),
('Disaronno','disaronno','liqueur','ml',700,'[]','amaretto'),
('Tia Maria','tia maria','liqueur','ml',700,'[]','coffee liqueur'),
('Kahlúa','kahlúa','liqueur','ml',700,'["kahlua"]','coffee liqueur'),
('Midori','midori','liqueur','ml',700,'[]','melon liqueur'),
('Archers','archers','liqueur','ml',700,'["archers peach schnapps"]','peach schnapps'),
('St-Germain','st-germain','liqueur','ml',700,'["st germain"]','elderflower liqueur'),
('Passoã','passoã','liqueur','ml',700,'["passoa"]','passion fruit liqueur'),
('Luxardo','luxardo','liqueur','ml',700,'["luxardo maraschino"]','maraschino liqueur'),
-- Standalone liqueurs
('Pimm''s','pimms','liqueur','ml',700,'["pimms no 1","pimms no1"]',NULL),
('Chartreuse','chartreuse','liqueur','ml',700,'["green chartreuse","yellow chartreuse"]',NULL),
('Galliano','galliano','liqueur','ml',700,'[]',NULL),
-- Vodka
('Stolichnaya','stolichnaya','spirit','ml',700,'["stoli"]','vodka'),
('Au Vodka','au vodka','spirit','ml',700,'[]','vodka'),
-- Gin
('Gordon''s Pink','gordons pink','spirit','ml',700,'["gordons pink gin"]','pink gin'),
('Roku','roku','spirit','ml',700,'["roku gin"]','gin'),
('Malfy','malfy','spirit','ml',700,'[]','gin'),
('Monkey 47','monkey 47','spirit','ml',500,'[]','gin'),
('The Botanist','the botanist','spirit','ml',700,'[]','gin'),
-- Rum
('Mount Gay','mount gay','spirit','ml',700,'[]','aged rum'),
('Appleton Estate','appleton estate','spirit','ml',700,'["appleton"]','aged rum'),
('Dead Man''s Fingers','dead mans fingers','spirit','ml',700,'[]','spiced rum'),
('Bumbu','bumbu','spirit','ml',700,'[]','spiced rum'),
('Diplomático','diplomático','spirit','ml',700,'["diplomatico"]','aged rum'),
('Plantation','plantation','spirit','ml',700,'[]','aged rum'),
-- Whisky
('Johnnie Walker','johnnie walker','spirit','ml',700,'["johnnie walker red","johnnie walker black"]','whisky'),
('Chivas Regal','chivas regal','spirit','ml',700,'["chivas"]','whisky'),
('Grant''s','grants','spirit','ml',700,'[]','whisky'),
('Teacher''s','teachers','spirit','ml',700,'[]','whisky'),
('Glenlivet','glenlivet','spirit','ml',700,'["the glenlivet"]','single malt scotch'),
('Macallan','macallan','spirit','ml',700,'["the macallan"]','single malt scotch'),
('Laphroaig','laphroaig','spirit','ml',700,'[]','single malt scotch'),
('Talisker','talisker','spirit','ml',700,'[]','single malt scotch'),
('Bushmills','bushmills','spirit','ml',700,'[]','irish whiskey'),
('Buffalo Trace','buffalo trace','spirit','ml',700,'[]','bourbon'),
('Wild Turkey','wild turkey','spirit','ml',700,'[]','bourbon'),
('Bulleit','bulleit','spirit','ml',700,'["bulleit bourbon"]','bourbon'),
-- Tequila
('Don Julio','don julio','spirit','ml',700,'[]','tequila'),
('Cazcabel','cazcabel','spirit','ml',700,'[]','tequila'),
('Camino','camino','spirit','ml',700,'["camino real"]','tequila'),
-- Cognac
('Martell','martell','spirit','ml',700,'[]','cognac'),
-- Soft drinks
('Red Bull','red bull','soft-drink','ml',250,'[]','energy drink'),
('Monster','monster','soft-drink','ml',500,'["monster energy"]','energy drink'),
('J2O','j2o','soft-drink','ml',275,'[]',NULL),
('Appletiser','appletiser','soft-drink','ml',275,'[]',NULL),
('Fanta','fanta','soft-drink','ml',330,'["fanta orange"]',NULL),
('Tango','tango','soft-drink','ml',330,'[]',NULL),
('Lucozade','lucozade','soft-drink','ml',380,'[]',NULL),
('Irn-Bru','irn-bru','soft-drink','ml',330,'["irn bru"]',NULL),
('Ribena','ribena','soft-drink','ml',288,'[]',NULL);
