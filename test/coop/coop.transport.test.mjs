// coop.transport.test.mjs — Integrationstest des Coop-Transports (js/coop.js).
//
// coop.js ist der GEMEINSAME Echtzeit-Transport aller vier Spiele (Imposter,
// Werwolf, Codenames, Wer bin ich?). Dieser Test fährt die ECHTE coop.js mit
// mehreren simulierten Clients gegen ein In-Memory-Firebase (fake-firebase.mjs,
// eingehängt per Loader-Hook) und prüft:
//   1. Raum-Lebenszyklus: hosten, beitreten, verlassen, Aufräumen
//   2. Broadcast-Fan-out: jede Nachricht erreicht ALLE anderen Clients (nicht den Autor)
//   3. Fehlerfälle: Code belegt / nicht gefunden / Raum voll
//   4. Nachrichten-Flows JE SPIEL — Beweis, dass der Transport für jedes Spiel
//      identisch funktioniert ("in der Funktion gleich").
//
// Start:  node --import ./test/coop/register-hook.mjs --test test/coop/coop.transport.test.mjs
// (oder:  npm run test:coop)

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { __reset, __store, __disconnect } from './fake-firebase.mjs';

// Jeder Client ist eine EIGENE coop.js-Modulinstanz (per ?c=-Cache-Buster),
// mit eigenem module-scope-State (fb/roomCode/…) — wie ein echtes Gerät.
let nextId = 0;
async function makeClient() {
  const Coop = await import(`../../js/coop.js?c=${++nextId}`);
  const received = [], joins = [], leaves = [];
  let uid = null;
  const api = {
    Coop, received, joins, leaves,
    get uid() { return uid; },
    host: (code, name) => new Promise((res, rej) => Coop.hostGame({
      code, name,
      onOpen: (u) => { uid = u; res(u); }, onError: rej,
      onJoin: (id, val) => joins.push({ id, val }),
      onLeave: (id) => leaves.push(id),
      onMessage: (m) => received.push(m),
    })),
    join: (code, name) => new Promise((res, rej) => Coop.joinGame({
      code, name,
      onOpen: (u) => { uid = u; res(u); }, onError: rej,
      onMessage: (m) => received.push(m),
      onClose: (id) => leaves.push(id),
    })),
    send: (m) => Coop.send(m),
    sendTo: (u, m) => Coop.sendTo(u, m),
    leave: () => Coop.leave(),
  };
  return api;
}

// Microtasks + Timer-Runde durchlaufen lassen (RTDB-Dispatch ist asynchron).
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(n = 3) { for (let i = 0; i < n; i++) await tick(); }

beforeEach(() => __reset());

// ── 1. Raum-Lebenszyklus & Broadcast ───────────────────────────────────────────
test('Host + zwei Gäste: Beitritte werden dem Host gemeldet', async () => {
  const host = await makeClient(), g1 = await makeClient(), g2 = await makeClient();
  await host.host('ABC123', 'Host');
  await g1.join('ABC123', 'Gast1');
  await g2.join('ABC123', 'Gast2');
  await settle();
  const joinedNames = host.joins.map((j) => j.val.name).sort();
  assert.deepEqual(joinedNames, ['Gast1', 'Gast2']);
  assert.notEqual(g1.uid, g2.uid);
});

test('Broadcast: Nachricht erreicht alle anderen, nicht den Autor', async () => {
  const host = await makeClient(), g1 = await makeClient(), g2 = await makeClient();
  await host.host('AAA111', 'Host');
  await g1.join('AAA111', 'Gast1');
  await g2.join('AAA111', 'Gast2');
  await settle();
  await g1.send({ type: 'hello', payload: 42 });
  await settle();
  assert.equal(host.received.filter((m) => m.type === 'hello').length, 1);
  assert.equal(g2.received.filter((m) => m.type === 'hello').length, 1);
  assert.equal(g1.received.filter((m) => m.type === 'hello').length, 0, 'Autor darf eigene Nachricht nicht erhalten');
  assert.equal(host.received.find((m) => m.type === 'hello').payload, 42);
});

test('sendTo hängt targetUid an und wird (Transport-seitig) an alle gesendet', async () => {
  const host = await makeClient(), g1 = await makeClient(), g2 = await makeClient();
  await host.host('BBB222', 'Host');
  await g1.join('BBB222', 'Gast1');
  await g2.join('BBB222', 'Gast2');
  await settle();
  await host.sendTo(g1.uid, { type: 'secret' });
  await settle();
  const at1 = g1.received.find((m) => m.type === 'secret');
  const at2 = g2.received.find((m) => m.type === 'secret');
  assert.ok(at1 && at1.targetUid === g1.uid);
  assert.ok(at2 && at2.targetUid === g1.uid, 'Zielfilterung passiert app-seitig über targetUid');
});

test('Verlassen: Host wird über Weggang eines Gastes informiert', async () => {
  const host = await makeClient(), g1 = await makeClient();
  await host.host('CCC333', 'Host');
  await g1.join('CCC333', 'Gast1');
  await settle();
  await g1.leave();
  await settle();
  assert.ok(host.leaves.includes(g1.uid));
});

test('Aufräumen: leerer Raum wird nach dem letzten Verlassen entfernt', async () => {
  const host = await makeClient(), g1 = await makeClient();
  await host.host('DDD444', 'Host');
  await g1.join('DDD444', 'Gast1');
  await settle();
  await g1.leave();
  await host.leave();
  await settle();
  assert.equal(__store().root.rooms?.DDD444, undefined);
});

test('Verbindungsabbruch: onDisconnect entfernt den Spieler und meldet ihn ab', async () => {
  const host = await makeClient(), g1 = await makeClient();
  await host.host('GGG777', 'Host');
  await g1.join('GGG777', 'Gast1');
  await settle();
  // Kein sauberes leave() — Verbindungsabbruch (Handy zu, Tunnel weg)
  await __disconnect(`rooms/GGG777/players/${g1.uid}`);
  await settle();
  assert.ok(host.leaves.includes(g1.uid), 'Host muss den abgebrochenen Gast als weg sehen');
  assert.equal(__store().root.rooms.GGG777.players[g1.uid], undefined);
});

// ── 2. Fehlerfälle ──────────────────────────────────────────────────────────────
test('Code belegt: zweiter Host auf gleichem Code wird abgelehnt', async () => {
  const host = await makeClient(), other = await makeClient();
  await host.host('EEE555', 'Host');
  await settle();
  await assert.rejects(() => other.host('EEE555', 'Andere'), (e) => e.type === 'code-taken');
});

test('Code nicht gefunden: Beitritt zu unbekanntem Raum wird abgelehnt', async () => {
  const g1 = await makeClient();
  await assert.rejects(() => g1.join('ZZZ999', 'Gast'), (e) => e.type === 'code-not-found');
});

test('Raum voll: Beitritt über COOP_MAX_PLAYERS hinaus wird abgelehnt', async () => {
  const { COOP_MAX_PLAYERS } = await import('../../js/config.js');
  const host = await makeClient();
  await host.host('FFF666', 'Host');
  for (let i = 1; i < COOP_MAX_PLAYERS; i++) { const g = await makeClient(); await g.join('FFF666', `Gast${i}`); }
  await settle();
  const overflow = await makeClient();
  await assert.rejects(() => overflow.join('FFF666', 'ZuViel'), (e) => e.type === 'room-full');
});

// ── 3. Nachrichten-Flows je Spiel (funktional gleich) ───────────────────────────
// Treibt für jedes Spiel die exakte Nachrichten-Sequenz und prüft, dass JEDE
// Nachricht bei ALLEN Nicht-Autoren ankommt (Broadcast-Parität über alle Spiele).
async function runGameFlow(script) {
  const host = await makeClient(), g1 = await makeClient(), g2 = await makeClient();
  const code = 'GAME01';
  await host.host(code, 'Host');
  await g1.join(code, 'Gast1');
  await g2.join(code, 'Gast2');
  await settle();
  const clients = { host, g1, g2 };
  let total = 0;
  const sentByAuthor = { host: 0, g1: 0, g2: 0 };
  for (const step of script(host.Coop.MSG)) {
    const c = clients[step.from];
    if (step.to) await c.sendTo(clients[step.to].uid, step.msg);
    else await c.send(step.msg);
    total++; sentByAuthor[step.from]++;
    await settle(1);
  }
  await settle();
  // Jeder Client muss genau die Nachrichten empfangen, die NICHT von ihm stammen.
  for (const name of ['host', 'g1', 'g2']) {
    assert.equal(clients[name].received.length, total - sentByAuthor[name],
      `${name} sollte alle Fremd-Nachrichten empfangen`);
  }
  return { host, g1, g2 };
}

test('Imposter-Flow: alle Coop-Nachrichten werden korrekt verteilt', async () => {
  await runGameFlow((MSG) => [
    { from: 'host', msg: { type: MSG.START, assignments: {} } },
    { from: 'g1', msg: { type: MSG.READY, ready: true } },
    { from: 'g2', msg: { type: MSG.READY, ready: true } },
    { from: 'g1', msg: { type: MSG.CARD_CONFIRMED } },
    { from: 'host', msg: { type: MSG.DISCUSSION_START } },
    { from: 'host', msg: { type: MSG.TIMER_SKIP } },
    { from: 'g1', msg: { type: MSG.POST_TIMER_VOTE, choice: 'vote' } },
    { from: 'host', msg: { type: MSG.POST_TIMER_RESULT, result: {} } },
    { from: 'host', msg: { type: MSG.VOTE_START, candidates: ['Host', 'Gast1', 'Gast2'] } },
    { from: 'g1', to: 'host', msg: { type: MSG.VOTE_CAST, targetName: 'Host' } },
    { from: 'host', msg: { type: MSG.VOTE_PROGRESS, count: 1, total: 3, voterNames: ['Gast1'] } },
    { from: 'host', msg: { type: MSG.VOTE_RESULT, result: {} } },
    { from: 'host', msg: { type: MSG.VOTE_CONTINUE, eliminated: ['Host'], candidates: ['Gast1', 'Gast2'] } },
    { from: 'host', msg: { type: MSG.RESULT, winner: 'village' } },
  ]);
});

test('Werwolf-Flow: Nacht- und Tag-Nachrichten werden korrekt verteilt', async () => {
  await runGameFlow((MSG) => [
    { from: 'host', msg: { type: MSG.START, assignments: {} } },
    { from: 'g1', msg: { type: MSG.READY, ready: true } },
    { from: 'host', msg: { type: MSG.NIGHT_START, round: 1 } },
    { from: 'host', to: 'g1', msg: { type: MSG.NIGHT_REQUEST, roleId: 'wolf', targets: ['Gast2'] } },
    { from: 'g1', to: 'host', msg: { type: MSG.NIGHT_SUBMIT, roleId: 'wolf', targetName: 'Gast2' } },
    { from: 'host', msg: { type: MSG.NIGHT_DONE, deaths: ['Gast2'] } },
    { from: 'host', msg: { type: MSG.VOTE_START, candidates: ['Host', 'Gast1'] } },
    { from: 'g1', to: 'host', msg: { type: MSG.VOTE_CAST, targetName: 'Host' } },
    { from: 'host', msg: { type: MSG.VOTE_RESULT, eliminated: 'Host', votes: {} } },
  ]);
});

test('Codenames-Flow: eigene CN_-Nachrichten werden korrekt verteilt', async () => {
  await runGameFlow(() => [
    { from: 'host', msg: { type: 'CN_LOBBY', players: [] } },
    { from: 'host', msg: { type: 'CN_START', board: [] } },
    { from: 'host', to: 'g1', msg: { type: 'CN_ASSIGNED_ROLE', role: 'spymaster' } },
    { from: 'host', msg: { type: 'CN_ROLE_UPDATE', roles: {} } },
    { from: 'host', to: 'g1', msg: { type: 'CN_SECRET', key: [] } },
    { from: 'g1', msg: { type: 'CN_HINT', word: 'Tier', count: 2 } },
    { from: 'g2', msg: { type: 'CN_REVEAL', index: 3 } },
    { from: 'g2', msg: { type: 'CN_PASS' } },
    { from: 'host', msg: { type: 'CN_END', winner: 'blue' } },
  ]);
});

test('Wer-bin-ich-Flow: eigene WBI_-Nachrichten werden korrekt verteilt', async () => {
  await runGameFlow(() => [
    { from: 'host', msg: { type: 'WBI_LOBBY', players: [] } },
    { from: 'host', msg: { type: 'WBI_START' } },
    { from: 'g1', msg: { type: 'WBI_READY', ready: true } },
    { from: 'host', to: 'g1', msg: { type: 'WBI_CARD', card: 'Einstein' } },
    { from: 'g1', msg: { type: 'WBI_GUESS', guess: 'Einstein' } },
    { from: 'host', msg: { type: 'WBI_RESULT', result: {} } },
  ]);
});
