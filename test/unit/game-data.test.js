import test from 'node:test';
import assert from 'node:assert/strict';

import { CN_WORDS, getCNWords } from '../../js/games/codenames-words.js';
import { WBI_ALL_CARDS } from '../../js/games/werbinich-words.js';

test('Codenames wählt mit partiellem Fisher-Yates deterministisch und ohne Duplikate', () => {
  const randomValues = [0.5, 0, 0.999];
  const selected = getCNWords('de', 3, () => randomValues.shift());
  const source = CN_WORDS.de;

  assert.deepEqual(selected, [source[Math.floor(source.length / 2)], source[1], source.at(-1)]);
  assert.equal(new Set(selected).size, selected.length);
});

test('Codenames begrenzt ungültige und zu große Kartenanzahlen sicher', () => {
  assert.deepEqual(getCNWords('de', -5), []);
  assert.deepEqual(getCNWords('de', Number.NaN), []);
  assert.equal(getCNWords('de', 10_000, () => 0).length, CN_WORDS.de.length);
});

test('Wer bin ich enthält den Eiffelturm nur in korrekter Schreibweise', () => {
  assert.equal(WBI_ALL_CARDS.filter(card => card.word === 'Eiffelturm').length, 1);
  assert.equal(WBI_ALL_CARDS.some(card => card.word === 'Eifelturm'), false);
});
