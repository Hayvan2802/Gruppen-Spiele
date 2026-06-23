/* ============================================
   IMPOSTER – Wortliste
   Version: 1.0.0
   Kategorien: Tiere, Essen, Sport, Orte,
               Berufe, Musik, Fantasy
   ============================================ */

const IMPOSTER_WORDS = {

  Tiere: [
    "Hund", "Katze", "Elefant", "Pinguin", "Delfin",
    "Tiger", "Affe", "Känguru", "Papagei", "Hai",
    "Giraffe", "Krokodil", "Koala", "Flamingo", "Wolf",
  ],

  Essen: [
    "Pizza", "Sushi", "Burger", "Pasta", "Tacos",
    "Ramen", "Schnitzel", "Döner", "Spaghetti", "Currywurst",
    "Pancakes", "Fondue", "Lasagne", "Falafel", "Sushi",
  ],

  Sport: [
    "Fußball", "Tennis", "Basketball", "Schwimmen", "Boxen",
    "Ski fahren", "Surfen", "Klettern", "Radfahren", "Golf",
    "Fechten", "Turnen", "Tischtennis", "Reiten", "Yoga",
  ],

  Orte: [
    "Strand", "Dschungel", "Wüste", "Iglu", "Raumschiff",
    "Kasino", "Krankenhaus", "Burg", "Unterwasserwelt", "Vulkan",
    "U-Bahn", "Leuchtturm", "Zirkus", "Bibliothek", "Weltraum",
  ],

  Berufe: [
    "Pilot", "Arzt", "Zauberer", "Detektiv", "Koch",
    "Astronaut", "Clown", "Rockstar", "Ninja", "Vampir",
    "Feuerwehrmann", "Taucher", "Dirigent", "Archäologe", "Zeitreisender",
  ],

  Musik: [
    "Gitarre", "Klavier", "Trompete", "Schlagzeug", "Geige",
    "Saxofon", "Flöte", "Kontrabass", "Harfe", "Ukulele",
  ],

  Fantasy: [
    "Drache", "Einhorn", "Zombie", "Pirat", "Roboter",
    "Hexe", "Meerjungfrau", "Werwolf", "Ritter", "Magier",
  ],

};

/* Alle Wörter als flache Liste */
const ALL_WORDS = Object.values(IMPOSTER_WORDS).flat();

function getRandomWord() {
  return ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)];
}
