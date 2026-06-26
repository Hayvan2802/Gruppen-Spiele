// werbinich-words.js — Kartendeck für "Wer bin ich?"
// Kategorien: Prominente, Sport, Film/TV, Musik, Politik, Figuren, Tiere, Orte, Dinge

export const WBI_KATEGORIEN = {

  '🎬 Schauspieler & Film': [
    'Leonardo DiCaprio', 'Meryl Streep', 'Tom Hanks', 'Scarlett Johansson',
    'Brad Pitt', 'Angelina Jolie', 'Johnny Depp', 'Natalie Portman',
    'Ryan Reynolds', 'Jennifer Lawrence', 'Will Smith', 'Emma Stone',
    'Dwayne Johnson', 'Margot Robbie', 'Robert Downey Jr.', 'Cate Blanchett',
    'Denzel Washington', 'Sandra Bullock', 'Morgan Freeman', 'Julia Roberts',
    'Heath Ledger', 'Audrey Hepburn', 'Marilyn Monroe', 'Charlie Chaplin',
    'Bruce Lee', 'Jackie Chan', 'Arnold Schwarzenegger', 'Sylvester Stallone',
  ],

  '🎵 Musik & Sänger': [
    'Michael Jackson', 'Madonna', 'Beyoncé', 'Taylor Swift', 'Rihanna',
    'Eminem', 'Lady Gaga', 'Ed Sheeran', 'Adele', 'Justin Bieber',
    'Elvis Presley', 'David Bowie', 'Freddie Mercury', 'Kurt Cobain',
    'Bob Marley', 'Tupac Shakur', 'Amy Winehouse', 'Whitney Houston',
    'The Beatles', 'ABBA', 'Shakira', 'Billie Eilish', 'Drake', 'Kanye West',
    'Elton John', 'Frank Sinatra', 'Mozart', 'Beethoven',
  ],

  '⚽ Sport & Athleten': [
    'Lionel Messi', 'Cristiano Ronaldo', 'Pelé', 'Diego Maradona',
    'Michael Jordan', 'LeBron James', 'Roger Federer', 'Rafael Nadal',
    'Novak Djokovic', 'Serena Williams', 'Muhammad Ali', 'Mike Tyson',
    'Usain Bolt', 'Michael Phelps', 'Tiger Woods', 'Michael Schumacher',
    'Lewis Hamilton', 'Valentina Vezzali', 'Simone Biles', 'Neymar',
    'Kylian Mbappé', 'Erling Haaland', 'Boris Becker', 'Steffi Graf',
    'Max Verstappen', 'Ronaldo (R9)', 'Zinedine Zidane', 'Ronaldinho',
  ],

  '🏛 Politik & Geschichte': [
    'Angela Merkel', 'Barack Obama', 'Donald Trump', 'Vladimir Putin',
    'Winston Churchill', 'Adolf Hitler', 'Napoleon Bonaparte', 'Julius Caesar',
    'Kleopatra', 'Alexander der Große', 'Karl der Große', 'Abraham Lincoln',
    'Nelson Mandela', 'Mahatma Gandhi', 'Che Guevara', 'Fidel Castro',
    'Queen Elizabeth II', 'Kaiser Wilhelm II', 'Bismarck', 'Lenin',
    'Joseph Stalin', 'Mao Zedong', 'Martin Luther King', 'Joan of Arc',
    'Anne Frank', 'Otto von Bismarck', 'Friedrich der Große', 'Ludwig XIV.',
  ],

  '🔬 Wissenschaft & Erfinder': [
    'Albert Einstein', 'Isaac Newton', 'Charles Darwin', 'Nikola Tesla',
    'Thomas Edison', 'Marie Curie', 'Stephen Hawking', 'Galileo Galilei',
    'Leonardo da Vinci', 'Sigmund Freud', 'Carl Sagan', 'Neil deGrasse Tyson',
    'Bill Gates', 'Steve Jobs', 'Elon Musk', 'Mark Zuckerberg',
    'Jeff Bezos', 'Alan Turing', 'Ada Lovelace', 'Alexander Fleming',
  ],

  '🦁 Tiere': [
    'Löwe', 'Elefant', 'Giraffe', 'Pinguin', 'Delfin', 'Hai', 'Krokodil',
    'Gorilla', 'Panda', 'Koala', 'Känguru', 'Nashorn', 'Zebra', 'Tiger',
    'Leopard', 'Wolf', 'Bär', 'Adler', 'Flamingo', 'Oktopus',
    'Chamäleon', 'Qualle', 'Piranha', 'Kängururatte', 'Platypus',
    'Axolotl', 'Tardigrad', 'Mantarochen', 'Blauwal', 'Schneeleopard',
  ],

  '🎭 Fiktive Figuren & Charaktere': [
    'Harry Potter', 'Hermione Granger', 'Gandalf', 'Frodo Beutlin',
    'Darth Vader', 'Luke Skywalker', 'Superman', 'Batman', 'Spider-Man',
    'Iron Man', 'Captain America', 'Joker', 'Sherlock Holmes', 'James Bond',
    'Indiana Jones', 'Jack Sparrow', 'Forrest Gump', 'Rocky Balboa',
    'The Terminator', 'Shrek', 'Simba', 'Elsa', 'Moana', 'Mulan',
    'Winnie Pooh', 'Mickey Mouse', 'Bugs Bunny', 'Homer Simpson',
    'Walter White', 'Tony Soprano', 'Tyrion Lannister', 'Jon Snow',
    'Daenerys Targaryen', 'Yoda', 'Gollum', 'Voldemort',
  ],

  '🌍 Orte & Sehenswürdigkeiten': [
    'Eiffelturm', 'Colosseum', 'Chinesische Mauer', 'Taj Mahal',
    'Machu Picchu', 'Niagara-Fälle', 'Grand Canyon', 'Sahara',
    'Amazonas', 'Himalaya', 'Ayers Rock', 'Big Ben', 'Freiheitsstatue',
    'Eifelturm', 'Brandenburger Tor', 'Oktoberfest', 'Venedig',
    'Las Vegas', 'Dubai', 'Tokio', 'New York', 'Paris', 'Rio de Janeiro',
    'Malediven', 'Island', 'Antarktis', 'Mond', 'Mars',
  ],

  '🎮 Dinge & Objekte': [
    'Smartphone', 'Flugzeug', 'U-Boot', 'Raumschiff', 'Leuchtturm',
    'Pyramide', 'Gitarre', 'Schachbrett', 'Zauberwürfel', 'Boomerang',
    'Periskop', 'Guillotine', 'Katapult', 'Zeitkapsel', 'Lügendetektor',
    'Teleporter', 'Zeitmaschine', 'Unsichtbarkeitsumhang', 'Zauberstab',
    'Schatzkarte', 'Schwarzes Loch', 'Trojanisches Pferd', 'Pandora-Box',
    'Achillesferse', 'Heiliger Gral', 'Excalibur', 'Kryptonit',
  ],

  '🍕 Essen & Trinken': [
    'Pizza', 'Sushi', 'Burger', 'Pasta', 'Tacos', 'Schnitzel',
    'Döner', 'Ramen', 'Spaghetti', 'Pancakes', 'Fondue', 'Lasagne',
    'Currywurst', 'Bretzel', 'Churros', 'Tiramisu', 'Käsekuchen',
    'Espresso', 'Champagner', 'Bier', 'Cola', 'Smoothie', 'Bubble Tea',
  ],

  '🇩🇪 Deutsche Prominente': [
    'Karl Lagerfeld', 'Heidi Klum', 'Til Schweiger', 'Christoph Waltz',
    'Diane Kruger', 'Michael Schumacher', 'Boris Becker', 'Steffi Graf',
    'Thomas Müller', 'Oliver Kahn', 'Franz Beckenbauer', 'Lothar Matthäus',
    'Herbert Grönemeyer', 'Helene Fischer', 'Udo Lindenberg', 'Rammstein',
    'Otto Waalkes', 'Dieter Bohlen', 'Stefan Raab', 'Harald Schmidt',
    'Karl Marx', 'Friedrich Nietzsche', 'Immanuel Kant', 'Johann Wolfgang von Goethe',
    'Friedrich Schiller', 'Ludwig van Beethoven', 'Johann Sebastian Bach',
  ],

};

export const WBI_ALL_CARDS = Object.entries(WBI_KATEGORIEN).flatMap(([kat, words]) =>
  words.map(w => ({ word: w, category: kat }))
);

export const WBI_DEFAULT_KATEGORIEN = [
  '🎬 Schauspieler & Film',
  '🎵 Musik & Sänger',
  '⚽ Sport & Athleten',
  '🎭 Fiktive Figuren & Charaktere',
  '🇩🇪 Deutsche Prominente',
];
