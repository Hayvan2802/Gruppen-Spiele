// config.js — Gruppen-Spiele Konfiguration
export const DONATE_URL = '';
export const COOP_MAX_PLAYERS = 16;
export const DEFAULT_SETTINGS = { theme: 'dark', lang: 'de' };
export const TIMER_SECONDS = 45;

export const IMPOSTER_WORDS = {
  Tiere:   ['Hund','Katze','Elefant','Pinguin','Delfin','Tiger','Affe','Känguru','Papagei','Hai','Giraffe','Krokodil','Koala','Flamingo','Wolf','Panda','Oktopus','Pferd'],
  Essen:   ['Pizza','Sushi','Burger','Pasta','Tacos','Ramen','Schnitzel','Döner','Spaghetti','Currywurst','Pancakes','Fondue','Lasagne','Falafel','Brownie','Crepe','Paella'],
  Sport:   ['Fußball','Tennis','Basketball','Schwimmen','Boxen','Ski fahren','Surfen','Klettern','Radfahren','Golf','Fechten','Turnen','Tischtennis','Reiten','Yoga','Skateboard'],
  Orte:    ['Strand','Dschungel','Wüste','Iglu','Raumschiff','Kasino','Krankenhaus','Burg','Unterwasserwelt','Vulkan','U-Bahn','Leuchtturm','Zirkus','Bibliothek','Weltraum','Baumhaus'],
  Berufe:  ['Pilot','Arzt','Zauberer','Detektiv','Koch','Astronaut','Clown','Rockstar','Ninja','Vampir','Feuerwehrmann','Taucher','Dirigent','Archäologe','Zeitreisender','Spion'],
  Musik:   ['Gitarre','Klavier','Trompete','Schlagzeug','Geige','Saxofon','Flöte','Kontrabass','Harfe','Ukulele','Theremin','Dudelsack'],
  Fantasy: ['Drache','Einhorn','Zombie','Pirat','Roboter','Hexe','Meerjungfrau','Werwolf','Ritter','Magier','Yeti','Gorilla'],
};
export const ALL_WORDS = Object.values(IMPOSTER_WORDS).flat();
