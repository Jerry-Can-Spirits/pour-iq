-- Modernise the shared ingredient catalogue to the new ingredient model and
-- seed it comprehensively for UK bars.
--
-- The catalogue is curated, cross-tenant reference data with no inbound FKs
-- (adoption COPIES a match into the tenant library), and nothing in the app
-- writes to it, so a DROP + rebuild is safe. Supersedes the partial seeds in
-- 0034/0035/0036/0037.
--
-- Model change: pricing_mode ('bottle'|'unit') + default_bottle_size_ml are
-- replaced by base_unit ('ml'|'g'|'each') + default_pack_size, matching the
-- tenant library (Slice 1). ingredient_type CHECK is aligned to the current
-- IngredientType union (adds 'soft-drink','food'). aliases (brand <-> generic
-- synonyms, lower-case JSON) is promoted into the schema.
--
-- normalised_name and every alias are stored lower-case, punctuation-free and
-- (where typed forms drop them) accent-free, so normalise(input) exact-matches.

DROP TABLE IF EXISTS pouriq_ingredient_catalogue;

CREATE TABLE pouriq_ingredient_catalogue (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  normalised_name TEXT NOT NULL UNIQUE,
  ingredient_type TEXT NOT NULL CHECK (ingredient_type IN
    ('spirit','liqueur','wine','beer','mixer','syrup','juice','garnish','soft-drink','food','other')),
  base_unit TEXT NOT NULL CHECK (base_unit IN ('ml','g','each')),
  default_pack_size REAL,
  aliases TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 1,
  contributor_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO pouriq_ingredient_catalogue (name, normalised_name, ingredient_type, base_unit, default_pack_size, aliases) VALUES
-- Spirits (700ml bottle)
('White Rum','white rum','spirit','ml',700,'["bacardi","light rum"]'),
('Dark Rum','dark rum','spirit','ml',700,'["navy rum"]'),
('Spiced Rum','spiced rum','spirit','ml',700,'["kraken","captain morgan","expedition spiced","expedition spiced rum"]'),
('Coconut Rum','coconut rum','spirit','ml',700,'["malibu"]'),
('Aged Rum','aged rum','spirit','ml',700,'["golden rum"]'),
('Overproof Rum','overproof rum','spirit','ml',700,'["wray and nephew"]'),
('Gin','gin','spirit','ml',700,'["london dry gin","gordons","beefeater","tanqueray"]'),
('Pink Gin','pink gin','spirit','ml',700,'[]'),
('Old Tom Gin','old tom gin','spirit','ml',700,'[]'),
('Vodka','vodka','spirit','ml',700,'["smirnoff","absolut","glens"]'),
('Vanilla Vodka','vanilla vodka','spirit','ml',700,'[]'),
('Whisky','whisky','spirit','ml',700,'["whiskey","scotch","blended scotch whisky","famous grouse","bells"]'),
('Single Malt Scotch','single malt scotch','spirit','ml',700,'["single malt"]'),
('Bourbon','bourbon','spirit','ml',700,'["jim beam","makers mark","woodford reserve","buffalo trace"]'),
('Rye Whiskey','rye whiskey','spirit','ml',700,'[]'),
('Irish Whiskey','irish whiskey','spirit','ml',700,'["jameson"]'),
('Tequila','tequila','spirit','ml',700,'["blanco tequila","jose cuervo","el jimador"]'),
('Reposado Tequila','reposado tequila','spirit','ml',700,'[]'),
('Anejo Tequila','anejo tequila','spirit','ml',700,'["añejo tequila"]'),
('Mezcal','mezcal','spirit','ml',700,'[]'),
('Brandy','brandy','spirit','ml',700,'[]'),
('Cognac','cognac','spirit','ml',700,'[]'),
('Pisco','pisco','spirit','ml',700,'[]'),
('Cachaca','cachaca','spirit','ml',700,'["cachaça"]'),
('Absinthe','absinthe','spirit','ml',700,'[]'),
-- Liqueurs (700ml; vermouth 750ml; bitters 100-200ml)
('Triple Sec','triple sec','liqueur','ml',700,'[]'),
('Cointreau','cointreau','liqueur','ml',700,'[]'),
('Grand Marnier','grand marnier','liqueur','ml',700,'[]'),
('Campari','campari','liqueur','ml',700,'[]'),
('Aperol','aperol','liqueur','ml',700,'[]'),
('Sweet Vermouth','sweet vermouth','liqueur','ml',750,'["sweet red vermouth","red vermouth","martini rosso","rosso"]'),
('Dry Vermouth','dry vermouth','liqueur','ml',750,'["martini extra dry","extra dry vermouth"]'),
('Coffee Liqueur','coffee liqueur','liqueur','ml',700,'["kahlua","tia maria"]'),
('Amaretto','amaretto','liqueur','ml',700,'["disaronno"]'),
('Elderflower Liqueur','elderflower liqueur','liqueur','ml',700,'["st germain"]'),
('Peach Schnapps','peach schnapps','liqueur','ml',700,'["archers"]'),
('Blue Curacao','blue curacao','liqueur','ml',700,'["blue curaçao"]'),
('Chambord','chambord','liqueur','ml',700,'["black raspberry liqueur"]'),
('Raspberry Liqueur','raspberry liqueur','liqueur','ml',700,'["creme de framboise"]'),
('Maraschino Liqueur','maraschino liqueur','liqueur','ml',700,'["luxardo"]'),
('Benedictine','benedictine','liqueur','ml',700,'[]'),
('Irish Cream','irish cream','liqueur','ml',700,'["baileys"]'),
('Limoncello','limoncello','liqueur','ml',700,'[]'),
('Sloe Gin','sloe gin','liqueur','ml',700,'[]'),
('Apricot Brandy','apricot brandy','liqueur','ml',700,'[]'),
('Melon Liqueur','melon liqueur','liqueur','ml',700,'["midori"]'),
('Banana Liqueur','banana liqueur','liqueur','ml',700,'["creme de banane"]'),
('Creme de Cassis','creme de cassis','liqueur','ml',700,'["cassis","blackcurrant liqueur"]'),
('Creme de Mure','creme de mure','liqueur','ml',700,'["crème de mure","blackberry liqueur"]'),
('Passion Fruit Liqueur','passion fruit liqueur','liqueur','ml',700,'["passoa","passionfruit liqueur"]'),
('Tequila Rose','tequila rose','liqueur','ml',700,'["strawberry cream liqueur"]'),
('Angostura Bitters','angostura bitters','liqueur','ml',200,'["bitters","aromatic bitters"]'),
('Orange Bitters','orange bitters','liqueur','ml',100,'[]'),
('Peychauds Bitters','peychauds bitters','liqueur','ml',100,'["peychaud bitters"]'),
-- Wine / sparkling (750ml)
('Prosecco','prosecco','wine','ml',750,'[]'),
('Champagne','champagne','wine','ml',750,'[]'),
('Cava','cava','wine','ml',750,'[]'),
('Red Wine','red wine','wine','ml',750,'[]'),
('White Wine','white wine','wine','ml',750,'[]'),
('Rose Wine','rose wine','wine','ml',750,'["rosé wine"]'),
('Aperitif Wine','aperitif wine','wine','ml',750,'["lillet"]'),
-- Beer / cider
('Lager','lager','beer','ml',330,'[]'),
('IPA','ipa','beer','ml',330,'["india pale ale"]'),
('Stout','stout','beer','ml',440,'["guinness"]'),
('Alcoholic Ginger Beer','alcoholic ginger beer','beer','ml',330,'["crabbies"]'),
('Cider','cider','beer','ml',500,'[]'),
-- Mixers / soft drinks
('Tonic Water','tonic water','mixer','ml',200,'["schweppes tonic","fever tree tonic","fever-tree tonic"]'),
('Slimline Tonic','slimline tonic','mixer','ml',200,'["light tonic","diet tonic"]'),
('Soda Water','soda water','mixer','ml',200,'["club soda","sparkling water"]'),
('Cola','cola','mixer','ml',200,'["coke","coca cola","coca-cola","pepsi"]'),
('Diet Cola','diet cola','mixer','ml',200,'["diet coke","coke zero","pepsi max"]'),
('Lemonade','lemonade','mixer','ml',200,'["sprite","7up","r whites"]'),
('Ginger Beer','ginger beer','mixer','ml',200,'["old jamaica","fever tree ginger beer"]'),
('Ginger Ale','ginger ale','mixer','ml',200,'["canada dry","schweppes ginger ale"]'),
('Bitter Lemon','bitter lemon','mixer','ml',200,'[]'),
-- Juices (1L)
('Lime Juice','lime juice','juice','ml',1000,'["fresh lime juice"]'),
('Lemon Juice','lemon juice','juice','ml',1000,'["fresh lemon juice"]'),
('Orange Juice','orange juice','juice','ml',1000,'[]'),
('Cranberry Juice','cranberry juice','juice','ml',1000,'[]'),
('Pineapple Juice','pineapple juice','juice','ml',1000,'[]'),
('Grapefruit Juice','grapefruit juice','juice','ml',1000,'[]'),
('Apple Juice','apple juice','juice','ml',1000,'[]'),
('Tomato Juice','tomato juice','juice','ml',1000,'[]'),
('Mango Juice','mango juice','juice','ml',1000,'[]'),
-- Purees (1L)
('Passion Fruit Puree','passion fruit puree','juice','ml',1000,'["passionfruit puree","funkin passion fruit"]'),
('Strawberry Puree','strawberry puree','juice','ml',1000,'["funkin strawberry"]'),
('Morello Cherry Puree','morello cherry puree','juice','ml',1000,'["cherry puree"]'),
('Mango Puree','mango puree','juice','ml',1000,'[]'),
-- Syrups / cordials (1L)
('Sugar Syrup','sugar syrup','syrup','ml',1000,'["simple syrup","gomme","gomme syrup"]'),
('Grenadine','grenadine','syrup','ml',1000,'[]'),
('Agave Syrup','agave syrup','syrup','ml',1000,'["agave nectar"]'),
('Honey Syrup','honey syrup','syrup','ml',1000,'[]'),
('Maple Syrup','maple syrup','syrup','ml',1000,'[]'),
('Orgeat','orgeat','syrup','ml',1000,'["almond syrup"]'),
('Vanilla Syrup','vanilla syrup','syrup','ml',1000,'[]'),
('Cinnamon Syrup','cinnamon syrup','syrup','ml',1000,'[]'),
('Passion Fruit Syrup','passion fruit syrup','syrup','ml',1000,'["passionfruit syrup"]'),
('Elderflower Cordial','elderflower cordial','syrup','ml',1000,'[]'),
('Coconut Cream','coconut cream','mixer','ml',400,'["coco lopez","cream of coconut"]'),
('Coconut Milk','coconut milk','mixer','ml',400,'[]'),
-- Garnish (each)
('Lime','lime','garnish','each',NULL,'["lime wedge","lime slice","lime wheel"]'),
('Lemon','lemon','garnish','each',NULL,'["lemon wedge","lemon slice"]'),
('Orange','orange','garnish','each',NULL,'["orange slice","orange peel"]'),
('Mint Sprig','mint sprig','garnish','each',NULL,'["mint","fresh mint","mint leaves"]'),
('Cocktail Cherry','cocktail cherry','garnish','each',NULL,'["cherry","maraschino cherry","cherries"]'),
('Olive','olive','garnish','each',NULL,'[]'),
('Cucumber','cucumber','garnish','each',NULL,'[]'),
('Strawberry','strawberry','garnish','each',NULL,'["strawberries","fresh strawberries"]'),
('Blackberry','blackberry','garnish','each',NULL,'["blackberries"]'),
('Raspberry','raspberry','garnish','each',NULL,'["raspberries","fresh raspberries"]'),
('Apple','apple','garnish','each',NULL,'["apple slice"]'),
('Passion Fruit','passion fruit','garnish','each',NULL,'["passionfruit"]'),
('Celery','celery','garnish','each',NULL,'["celery stick"]'),
-- Food / weight / count staples (now expressible: g / each)
('Caster Sugar','caster sugar','food','g',1000,'["sugar","white sugar"]'),
('Brown Sugar','brown sugar','food','g',1000,'["demerara sugar"]'),
('Coffee Beans','coffee beans','food','g',1000,'["coffee bean"]'),
('Egg White','egg white','food','each',NULL,'["egg"]'),
('Single Cream','single cream','food','ml',1000,'["cream"]'),
('Double Cream','double cream','food','ml',1000,'[]'),
('Espresso','espresso','food','ml',1000,'["coffee","espresso shot"]'),
('Worcestershire Sauce','worcestershire sauce','food','ml',150,'[]'),
('Tabasco','tabasco','food','ml',60,'["hot sauce"]'),
('Chocolate Sauce','chocolate sauce','food','ml',1000,'[]'),
('Vanilla Ice Cream','vanilla ice cream','food','g',1000,'["ice cream","ice-cream"]'),
('Salt','salt','food','g',750,'[]'),
('Black Pepper','black pepper','food','g',100,'["pepper"]');

-- Rename the barcode catalogue size column for naming consistency with the new
-- model (still implicitly ml; no base_unit added). Preserves tenant rows.
ALTER TABLE pouriq_barcode_catalogue RENAME COLUMN bottle_size_ml TO pack_size_ml;
