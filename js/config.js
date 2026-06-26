// config.js — Gruppen-Spiele Konfiguration

export const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light' | 'auto'
};

export const TIMER_SECONDS = 45;

export const IMPOSTER_WORDS = {
  Tiere:   ['Hund','Katze','Elefant','Pinguin','Delfin','Tiger','Affe','Känguru','Papagei','Hai','Giraffe','Krokodil','Koala','Flamingo','Wolf'],
  Essen:   ['Pizza','Sushi','Burger','Pasta','Tacos','Ramen','Schnitzel','Döner','Spaghetti','Currywurst','Pancakes','Fondue','Lasagne','Falafel','Brownie'],
  Sport:   ['Fußball','Tennis','Basketball','Schwimmen','Boxen','Ski fahren','Surfen','Klettern','Radfahren','Golf','Fechten','Turnen','Tischtennis','Reiten','Yoga'],
  Orte:    ['Strand','Dschungel','Wüste','Iglu','Raumschiff','Kasino','Krankenhaus','Burg','Unterwasserwelt','Vulkan','U-Bahn','Leuchtturm','Zirkus','Bibliothek','Weltraum'],
  Berufe:  ['Pilot','Arzt','Zauberer','Detektiv','Koch','Astronaut','Clown','Rockstar','Ninja','Vampir','Feuerwehrmann','Taucher','Dirigent','Archäologe','Zeitreisender'],
  Musik:   ['Gitarre','Klavier','Trompete','Schlagzeug','Geige','Saxofon','Flöte','Kontrabass','Harfe','Ukulele'],
  Fantasy: ['Drache','Einhorn','Zombie','Pirat','Roboter','Hexe','Meerjungfrau','Werwolf','Ritter','Magier'],
};

export const ALL_WORDS = Object.values(IMPOSTER_WORDS).flat();
