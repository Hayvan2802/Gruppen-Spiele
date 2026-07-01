#!/usr/bin/env python3
"""coop_live_smoke.py — Live-Smoke-Test des Coop-Modus gegen ECHTES Firebase.

Meldet sich (wie die App) anonym an, erzeugt zwei "Geräte" (Host + Gast),
hostet/betritt einen Wegwerf-Raum und spielt für JEDES Spiel die exakte
Coop-Nachrichten-Sequenz über die RTDB durch. Prüft, dass jede Nachricht beim
jeweils anderen Gerät ankommt — beweist, dass Coop real funktioniert und für
alle Spiele gleich läuft. Räumt am Ende auf.

Nur Standardbibliothek (urllib) — keine Zusatzpakete. API-Key + DB-URL werden aus
js/firebase.js gelesen (der Web-API-Key ist öffentlich, siehe Kommentar dort).

Start:   python3 test/coop/coop_live_smoke.py
         python3 test/coop/coop_live_smoke.py --game imposter   # einzelnes Spiel
Exit-Code 0 = alles grün, 1 = mindestens ein Fehler.

HINWEIS: Braucht Netzwerkzugriff auf *.firebasedatabase.app. In abgeschotteten
CI-/Agent-Umgebungen kann der RTDB-Host geblockt sein — dann lokal ausführen.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SV = {".sv": "timestamp"}  # RTDB-Server-Zeitstempel


def read_firebase_config():
    """apiKey + databaseURL aus js/firebase.js ziehen (Single Source of Truth)."""
    src = open(os.path.join(ROOT, "js", "firebase.js"), encoding="utf-8").read()
    api = re.search(r"apiKey:\s*'([^']+)'", src)
    db = re.search(r"databaseURL:\s*'([^']+)'", src)
    if not api or not db:
        sys.exit("Konnte apiKey/databaseURL nicht aus js/firebase.js lesen")
    return api.group(1), db.group(1).rstrip("/")


def _post(url, payload):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def sign_in_anonymous(api_key):
    """Anonyme Anmeldung wie die App → (idToken, uid)."""
    res = _post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key}",
        {"returnSecureToken": True},
    )
    return res["idToken"], res["localId"]


class Client:
    """Ein simuliertes Gerät: eigene anonyme Identität + RTDB-Zugriff."""

    def __init__(self, db_url, api_key, name):
        self.db = db_url
        self.name = name
        self.token, self.uid = sign_in_anonymous(api_key)

    def _url(self, path):
        return f"{self.db}/{path}.json?auth={self.token}"

    def put(self, path, value):
        req = urllib.request.Request(self._url(path), data=json.dumps(value).encode(), method="PUT")
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())

    def get(self, path):
        with urllib.request.urlopen(self._url(path), timeout=20) as r:
            return json.loads(r.read().decode())

    def delete(self, path):
        req = urllib.request.Request(self._url(path), method="DELETE")
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()

    def push(self, path, value):
        return _post_auth(self._url(path), value)

    # ── Coop-Aktionen (spiegeln js/coop.js) ──
    def host(self, code):
        self.code = code
        self.put(f"rooms/{code}/meta", {"hostId": self.uid, "createdAt": SV, "status": "open"})
        self.put(f"rooms/{code}/players/{self.uid}",
                 {"name": self.name, "color": "#c9a84c", "role": "host", "joinedAt": SV})

    def join(self, code):
        self.code = code
        players = self.get(f"rooms/{code}/players")
        if not players:
            raise RuntimeError("code-not-found")
        self.put(f"rooms/{code}/players/{self.uid}",
                 {"name": self.name, "color": "#6b7fd4", "role": "guest", "joinedAt": SV})

    def send(self, msg):
        self.push(f"rooms/{self.code}/events", {**msg, "author": self.uid, "ts": SV})

    def events(self):
        data = self.get(f"rooms/{self.code}/events") or {}
        return list(data.values())


def _post_auth(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


# ── Nachrichten-Flows je Spiel (identisch zu coop.transport.test.mjs) ──
# 'h' = Host sendet, 'g' = Gast sendet. type + evtl. Nutzlast.
def game_flows():
    return {
        "imposter": [
            ("h", {"type": "start"}), ("g", {"type": "ready"}), ("g", {"type": "card_confirmed"}),
            ("h", {"type": "discussion_start"}), ("h", {"type": "timer_skip"}),
            ("g", {"type": "post_timer_vote"}), ("h", {"type": "post_timer_result"}),
            ("h", {"type": "vote_start"}), ("g", {"type": "vote_cast", "targetUid": "HOST"}),
            ("h", {"type": "vote_progress"}), ("h", {"type": "vote_result"}),
            ("h", {"type": "vote_continue"}), ("h", {"type": "result"}),
        ],
        "werwolf": [
            ("h", {"type": "start"}), ("g", {"type": "ready"}), ("h", {"type": "night_start"}),
            ("h", {"type": "night_request", "targetUid": "GUEST"}),
            ("g", {"type": "night_submit", "targetUid": "HOST"}),
            ("h", {"type": "night_done"}), ("h", {"type": "vote_start"}),
            ("g", {"type": "vote_cast", "targetUid": "HOST"}), ("h", {"type": "vote_result"}),
        ],
        "codenames": [
            ("h", {"type": "CN_LOBBY"}), ("h", {"type": "CN_START"}),
            ("h", {"type": "CN_ASSIGNED_ROLE", "targetUid": "GUEST"}), ("h", {"type": "CN_ROLE_UPDATE"}),
            ("h", {"type": "CN_SECRET", "targetUid": "GUEST"}), ("g", {"type": "CN_HINT"}),
            ("g", {"type": "CN_REVEAL"}), ("g", {"type": "CN_PASS"}), ("h", {"type": "CN_END"}),
        ],
        "werbinich": [
            ("h", {"type": "WBI_LOBBY"}), ("h", {"type": "WBI_START"}), ("g", {"type": "WBI_READY"}),
            ("h", {"type": "WBI_CARD", "targetUid": "GUEST"}), ("g", {"type": "WBI_GUESS"}),
            ("h", {"type": "WBI_RESULT"}),
        ],
    }


def run_game(game, flow, db_url, api_key):
    code = f"T{int(time.time()) % 100000:05d}"
    host = Client(db_url, api_key, "SmokeHost")
    guest = Client(db_url, api_key, "SmokeGast")
    try:
        host.host(code)
        guest.join(code)
        # Host muss den Gast in players sehen
        players = host.get(f"rooms/{code}/players") or {}
        assert guest.uid in players, "Host sieht den beigetretenen Gast nicht"

        sent = {"h": 0, "g": 0}
        for who, msg in flow:
            (host if who == "h" else guest).send(msg)
            sent[who] += 1
            time.sleep(0.15)
        time.sleep(0.8)  # RTDB-Propagation

        host_recv = [e for e in host.events() if e.get("author") != host.uid]
        guest_recv = [e for e in guest.events() if e.get("author") != guest.uid]
        assert len(guest_recv) == sent["h"], f"Gast empfing {len(guest_recv)}, erwartet {sent['h']}"
        assert len(host_recv) == sent["g"], f"Host empfing {len(host_recv)}, erwartet {sent['g']}"
        return True, f"{len(flow)} Nachrichten, alle korrekt verteilt"
    except AssertionError as e:
        return False, str(e)
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"
    finally:
        try:
            host.delete(f"rooms/{code}")
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser(description="Live-Smoke-Test des Coop-Modus gegen echtes Firebase")
    ap.add_argument("--game", choices=list(game_flows().keys()), help="nur ein Spiel testen")
    args = ap.parse_args()

    api_key, db_url = read_firebase_config()
    flows = game_flows()
    if args.game:
        flows = {args.game: flows[args.game]}

    print(f"Coop-Live-Smoke gegen {db_url}\n")
    ok = True
    for game, flow in flows.items():
        try:
            passed, detail = run_game(game, flow, db_url, api_key)
        except urllib.error.URLError as e:
            passed, detail = False, f"Netzwerk/Firebase nicht erreichbar: {e}"
        mark = "✅" if passed else "❌"
        print(f"{mark}  {game:<12} {detail}")
        ok = ok and passed

    print("\n" + ("Alle Coop-Modi funktionieren." if ok else "Mindestens ein Coop-Modus ist FEHLGESCHLAGEN."))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
