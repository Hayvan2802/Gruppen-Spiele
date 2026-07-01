# Coop-Tests

Testet den Echtzeit-**Coop-Modus** aller vier Spiele (Imposter, Werwolf,
Codenames, Wer bin ich?). Alle Spiele teilen sich denselben Transport
(`js/coop.js` + Firebase RTDB) — hier wird geprüft, dass Coop wirklich
funktioniert **und für jedes Spiel gleich läuft**.

Es gibt zwei Ebenen:

## 1. Transport-Integrationstest (offline, immer lauffähig)

```bash
npm run test:coop
```

Fährt die **echte** `js/coop.js` mit mehreren simulierten Clients gegen ein
In-Memory-Firebase (`fake-firebase.mjs`, per Loader-Hook eingehängt). Prüft:

- Raum-Lebenszyklus: hosten, beitreten, verlassen, Aufräumen
- Broadcast-Fan-out: jede Nachricht erreicht **alle** anderen Clients (nicht den Autor)
- Verbindungsabbruch (`onDisconnect`) meldet Spieler korrekt ab
- Fehlerfälle: Code belegt / Code nicht gefunden / Raum voll
- **Nachrichten-Flow je Spiel** — die exakte Sequenz jedes Spiels wird verteilt

Läuft ohne Netzwerk und ohne Zusatzpakete → auch Teil der CI (Job „Unit Tests").

Dateien:
- `fake-firebase.mjs` — In-Memory-Nachbau der genutzten RTDB-API
- `firebase-hook.mjs` — ESM-Loader-Hook: leitet `firebase.js` auf den Fake um
- `register-hook.mjs` — Preload (registriert Hook + `localStorage`-Stub)
- `coop.transport.test.mjs` — die Testfälle

## 2. Live-Smoke gegen echtes Firebase (auf Wunsch, braucht Netzwerk)

```bash
npm run test:coop:live            # alle Spiele
python3 test/coop/coop_live_smoke.py --game imposter   # nur eines
```

Meldet sich – wie die App – anonym an, erzeugt zwei „Geräte" (Host + Gast),
hostet/betritt einen Wegwerf-Raum in der **echten** Realtime Database und spielt
je Spiel die Coop-Nachrichten durch. Prüft, dass jede Nachricht beim anderen
Gerät ankommt, und räumt den Raum danach wieder auf. Exit-Code `0` = alles grün.

Nur Python-Standardbibliothek, keine Zusatzpakete. API-Key + DB-URL werden aus
`js/firebase.js` gelesen (der Web-API-Key ist öffentlich).

> **Hinweis:** Braucht ausgehenden Zugriff auf `*.firebasedatabase.app`. In
> abgeschotteten CI-/Sandbox-Umgebungen ist der RTDB-Host teils geblockt — dann
> lokal ausführen. Deshalb ist nur der Offline-Test (1) in der CI verdrahtet.
