-- Catalogue brand tier: cover brand-level products so branded invoice/menu
-- lines (three different keg lagers) import as distinct, correctly-typed
-- products instead of collapsing onto one generic.
--
-- Adds a nullable `generic` column linking a brand to its generic entry
-- (= the generic's normalised_name; NULL for generic rows and for standalone
-- ales with no matching generic). Brands inherit their generic's type/unit/
-- size as sensible defaults; the line and the matcher's specific-name logic
-- carry the real product name and size.
--
-- Additive only. Brand names that already exist as ALIASES on a generic are
-- left as-is: the matcher prefers an exact name over an alias, so a brand
-- entry wins regardless. normalised_name/aliases are lower-case and stored
-- exactly as normalise() produces them (it keeps accents and "&"), with the
-- accent-free / spelled-out variant listed as an alias so both forms match.

ALTER TABLE pouriq_ingredient_catalogue ADD COLUMN generic TEXT;

INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases, generic) VALUES
-- Lager
('Carling','carling','beer','ml',330,'[]','lager'),
('Foster''s','fosters','beer','ml',330,'[]','lager'),
('Carlsberg','carlsberg','beer','ml',330,'[]','lager'),
('Stella Artois','stella artois','beer','ml',330,'["stella"]','lager'),
('Madrí','madrí','beer','ml',330,'["madri","madri excepcional"]','lager'),
('San Miguel','san miguel','beer','ml',330,'[]','lager'),
('Peroni','peroni','beer','ml',330,'[]','lager'),
('Birra Moretti','birra moretti','beer','ml',330,'["moretti"]','lager'),
('Amstel','amstel','beer','ml',330,'[]','lager'),
('Heineken','heineken','beer','ml',330,'[]','lager'),
('Coors','coors','beer','ml',330,'["coors light"]','lager'),
('Cruzcampo','cruzcampo','beer','ml',330,'[]','lager'),
('Asahi','asahi','beer','ml',330,'[]','lager'),
('Estrella','estrella','beer','ml',330,'["estrella damm"]','lager'),
('Camden Hells','camden hells','beer','ml',330,'["hells lager"]','lager'),
-- Stout / ale
('Guinness','guinness','beer','ml',440,'[]','stout'),
('Neck Oil','neck oil','beer','ml',330,'["beavertown neck oil"]','ipa'),
('Camden Pale','camden pale','beer','ml',330,'["camden pale ale"]','ipa'),
('Doom Bar','doom bar','beer','ml',500,'["sharps doom bar"]',NULL),
('Hobgoblin','hobgoblin','beer','ml',500,'[]',NULL),
('Old Speckled Hen','old speckled hen','beer','ml',500,'[]',NULL),
-- Cider
('Thatchers','thatchers','beer','ml',500,'["thatchers gold"]','cider'),
('Strongbow','strongbow','beer','ml',500,'[]','cider'),
('Aspall','aspall','beer','ml',500,'[]','cider'),
('Inch''s','inchs','beer','ml',500,'[]','cider'),
('Kopparberg','kopparberg','beer','ml',500,'[]','cider'),
('Rekorderlig','rekorderlig','beer','ml',500,'[]','cider'),
('Magners','magners','beer','ml',500,'[]','cider'),
-- Vodka
('Smirnoff','smirnoff','spirit','ml',700,'["smirnoff red"]','vodka'),
('Absolut','absolut','spirit','ml',700,'[]','vodka'),
('Russian Standard','russian standard','spirit','ml',700,'[]','vodka'),
('Grey Goose','grey goose','spirit','ml',700,'[]','vodka'),
('Belvedere','belvedere','spirit','ml',700,'[]','vodka'),
('Ciroc','ciroc','spirit','ml',700,'[]','vodka'),
('Glen''s','glens','spirit','ml',700,'[]','vodka'),
-- Gin
('Gordon''s','gordons','spirit','ml',700,'[]','gin'),
('Bombay Sapphire','bombay sapphire','spirit','ml',700,'["bombay"]','gin'),
('Tanqueray','tanqueray','spirit','ml',700,'[]','gin'),
('Beefeater','beefeater','spirit','ml',700,'[]','gin'),
('Hendrick''s','hendricks','spirit','ml',700,'[]','gin'),
('Whitley Neill','whitley neill','spirit','ml',700,'[]','gin'),
('Sipsmith','sipsmith','spirit','ml',700,'[]','gin'),
('Brockmans','brockmans','spirit','ml',700,'[]','gin'),
-- Rum
('Bacardi','bacardi','spirit','ml',700,'[]','white rum'),
('Captain Morgan','captain morgan','spirit','ml',700,'[]','spiced rum'),
('Kraken','kraken','spirit','ml',700,'["the kraken"]','spiced rum'),
('Sailor Jerry','sailor jerry','spirit','ml',700,'[]','spiced rum'),
('Havana Club','havana club','spirit','ml',700,'["havana"]','aged rum'),
('Lamb''s','lambs','spirit','ml',700,'["lambs navy"]','dark rum'),
('Wray & Nephew','wray & nephew','spirit','ml',700,'["wray and nephew"]','overproof rum'),
('Malibu','malibu','spirit','ml',700,'[]','coconut rum'),
-- Whisky
('Jack Daniel''s','jack daniels','spirit','ml',700,'["jd"]','whisky'),
('Famous Grouse','famous grouse','spirit','ml',700,'["the famous grouse"]','whisky'),
('Bell''s','bells','spirit','ml',700,'[]','whisky'),
('Monkey Shoulder','monkey shoulder','spirit','ml',700,'[]','whisky'),
('Jim Beam','jim beam','spirit','ml',700,'[]','bourbon'),
('Maker''s Mark','makers mark','spirit','ml',700,'[]','bourbon'),
('Woodford Reserve','woodford reserve','spirit','ml',700,'["woodford"]','bourbon'),
('Jameson','jameson','spirit','ml',700,'[]','irish whiskey'),
('Glenfiddich','glenfiddich','spirit','ml',700,'[]','single malt scotch'),
('Glenmorangie','glenmorangie','spirit','ml',700,'[]','single malt scotch'),
-- Tequila
('Jose Cuervo','jose cuervo','spirit','ml',700,'["cuervo"]','tequila'),
('Olmeca','olmeca','spirit','ml',700,'[]','tequila'),
('Patrón','patrón','spirit','ml',700,'["patron"]','tequila'),
('El Jimador','el jimador','spirit','ml',700,'[]','tequila'),
-- Brandy / cognac
('Courvoisier','courvoisier','spirit','ml',700,'[]','cognac'),
('Hennessy','hennessy','spirit','ml',700,'[]','cognac'),
('Rémy Martin','rémy martin','spirit','ml',700,'["remy","remy martin"]','cognac'),
-- Vermouth / aperitif
('Martini Rosso','martini rosso','liqueur','ml',750,'["martini"]','sweet vermouth'),
('Martini Extra Dry','martini extra dry','liqueur','ml',750,'[]','dry vermouth'),
('Noilly Prat','noilly prat','liqueur','ml',750,'[]','dry vermouth'),
('Lillet','lillet','wine','ml',750,'[]','aperitif wine');
