// config.js — Gruppen-Spiele Konfiguration v0.20
export const DONATE_URL      = '';
export const COOP_MAX_PLAYERS = 16;
export const DEFAULT_SETTINGS = { theme: 'dark', lang: 'de' };

// Timer-Dauer wird dynamisch in app.js berechnet

// ── Kategorien mit vielen Wörtern ────────────────────────────────────────────
export const KATEGORIEN = {
  '🐾 Tiere': [
    'Hund','Katze','Elefant','Pinguin','Delfin','Tiger','Affe','Känguru','Papagei','Hai',
    'Giraffe','Krokodil','Koala','Flamingo','Wolf','Panda','Oktopus','Pferd','Löwe','Zebra',
    'Gorilla','Eisbär','Schildkröte','Chamäleon','Qualle','Adler','Fledermaus','Nashorn','Otter','Igel',
  ],
  '🍕 Essen & Trinken': [
    'Pizza','Sushi','Burger','Pasta','Tacos','Ramen','Schnitzel','Döner','Spaghetti','Currywurst',
    'Pancakes','Fondue','Lasagne','Falafel','Brownie','Crepe','Paella','Moussaka','Pho','Bibimbap',
    'Espresso','Smoothie','Limo','Boba Tea','Käsekuchen','Tiramisu','Brezel','Churros','Gyros','Hummus',
  ],
  '⚽ Sport': [
    'Fußball','Tennis','Basketball','Schwimmen','Boxen','Ski fahren','Surfen','Klettern','Radfahren','Golf',
    'Fechten','Turnen','Tischtennis','Reiten','Yoga','Skateboard','Volleyball','Rugby','Baseball','Bowling',
    'Bogenschießen','Curling','Triathlon','Breakdance','Kampfsport','Darts','Snooker','Fallschirmspringen','Kanu','Eiskunstlauf',
  ],
  '🏝 Orte & Landschaften': [
    'Strand','Dschungel','Wüste','Iglu','Raumschiff','Kasino','Krankenhaus','Burg','Unterwasserwelt','Vulkan',
    'U-Bahn','Leuchtturm','Zirkus','Bibliothek','Weltraum','Baumhaus','Höhle','Tempel','Fischerboot','Schneepalast',
    'Unterwasserbasis','Geisterhaus','Flughafen','Unterwasserrestaurant','Piratenschiff','Gefängnis','Labyrinth','Mondstation','Zeppelin','Schlossgarten',
  ],
  '💼 Berufe': [
    'Pilot','Arzt','Zauberer','Detektiv','Koch','Astronaut','Clown','Rockstar','Ninja','Vampir',
    'Feuerwehrmann','Taucher','Dirigent','Archäologe','Zeitreisender','Spion','Bestatter','Zoodirektor','Hacker','Tätowierer',
    'Weinverkoster','Stuntman','Gerichtsmediziner','Schatzjäger','Formel-1-Fahrer','Bergsteiger','Ghostwriter','Puppenspieler','Kriegsreporter','Unterwasserfotograf',
  ],
  '🎸 Musik & Instrumente': [
    'Gitarre','Klavier','Trompete','Schlagzeug','Geige','Saxofon','Flöte','Kontrabass','Harfe','Ukulele',
    'Theremin','Dudelsack','Akkordeon','Cello','Oboe','Didgeridoo','Sitar','Banjo','Kazoo','Posaune',
  ],
  '🐉 Fantasy & Sci-Fi': [
    'Drache','Einhorn','Zombie','Pirat','Roboter','Hexe','Meerjungfrau','Werwolf','Ritter','Magier',
    'Yeti','Gorilla','Alien','Cyborg','Zauberstab','Zeitmaschine','Teleporter','Unsichtbarkeitsumhang','Raumanzug','Lichtschwert',
    'Drachenzähmer','Gedankenleser','Mutant','Klon','Unsterblicher','Geist','Golem','Troll','Elfe','Zwerg',
  ],
  '🎬 Film & TV': [
    'Detektivfilm','Horrorfilm','Komödie','Actionfilm','Dokumentation','Stummfilm','Bollywood','Anime','Western','Sciencefiction',
    'Talkshow','Reality-TV','Nachrichtensprecher','Gameshow','Telenovela','Krimiserie','Fantasyserie','Zeichentrick','Märchenfilm','Thriller',
  ],
  '🎨 Kunst & Kultur': [
    'Ölgemälde','Skulptur','Graffiti','Origami','Kalligrafie','Mosaik','Batik','Holzschnitt','Aquarell','Collage',
    'Pantomime','Ballett','Oper','Streetart','Sandkunst','Lichtinstallation','Bodypainting','Glasmalerei','Wandteppich','Hologramm',
  ],
  '🌍 Länder & Kulturen': [
    'Japan','Brasilien','Ägypten','Island','Australien','Indien','Mexiko','Norwegen','Südkorea','Marokko',
    'Neuseeland','Thailand','Griechenland','Peru','Kanada','Äthiopien','Finnland','Vietnam','Argentinien','Portugal',
  ],
  '🔬 Wissenschaft & Technik': [
    'Schwarzes Loch','DNA','Quantencomputer','Kernfusion','Klonen','Telekinese','Nanotechnologie','Roboter-KI','Wormhole','Antimaterie',
    'Hologramm','Drohne','3D-Drucker','Rakete','Satellit','Supercomputer','Laser','Elektroauto','Solarpanel','Exoskelett',
  ],
  '🎃 Saisonale Themen': [
    'Weihnachten','Halloween','Karneval','Ostern','Silvester','Valentinstag','Erntedankfest','Diwali','Ramadan','Chanukka',
  ],
  '🍺 Party & Freizeit': [
    'Karaoke','Escape Room','Lasertag','Paintball','Billard','Tischfußball','Cocktailbar','Beachparty','Rave','Grillparty',
    'Spieleabend','Quizabend','Hausparty','Strandvolleyball','Kochkurs','Weinprobe','Saunagang','Kickboxen','Wakeboarden','Kletterpark',
  ],
};

// Alle Wörter flach (Fallback wenn keine Kategorie gewählt)
export const ALL_WORDS = Object.values(KATEGORIEN).flat();

// Standardmäßig ausgewählte Kategorien
export const DEFAULT_KATEGORIEN = ['🐾 Tiere', '🍕 Essen & Trinken', '⚽ Sport', '🏝 Orte & Landschaften', '💼 Berufe'];
