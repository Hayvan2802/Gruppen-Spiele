/* ============================================
   GRUPPEN-SPIELE – App Controller
   Version: 1.0.0
   Zentraler State & Handler für alle Spiele.
   ============================================ */

const state = {
  phase:          'setup',  // setup | pass | voting | result
  namen:          [],
  eingabe:        '',
  imposterAnzahl: 1,
  rollen:         [],
  aktIdx:         0,
  gezeigt:        false,
  stimmen:        {},
  stimmIdx:       0,
};

const handlers = {

  hinzufuegen() {
    const val = state.eingabe.trim();
    if (val && !state.namen.includes(val)) {
      state.namen.push(val);
      state.eingabe = '';
      render();
    }
  },

  entfernen(i) {
    state.namen.splice(i, 1);
    render();
  },

  setImposter(n) {
    state.imposterAnzahl = n;
    render();
  },

  starten() {
    if (state.namen.length < 3) return;
    state.rollen   = createRoles(state.namen, state.imposterAnzahl);
    state.aktIdx   = 0;
    state.gezeigt  = false;
    state.stimmen  = {};
    state.stimmIdx = 0;
    state.phase    = 'pass';
    render();
  },

  zeigen()    { state.gezeigt = true;  render(); },
  verstecken(){ state.gezeigt = false; render(); },

  weiter() {
    if (state.aktIdx + 1 >= state.rollen.length) {
      state.phase    = 'voting';
      state.stimmIdx = 0;
    } else {
      state.aktIdx++;
      state.gezeigt = false;
    }
    render();
  },

  abstimmen(ziel) {
    const abstimmender = state.rollen[state.stimmIdx].name;
    state.stimmen[abstimmender] = ziel;
    if (state.stimmIdx + 1 >= state.rollen.length) {
      state.phase = 'result';
    } else {
      state.stimmIdx++;
    }
    render();
  },

  neustart() {
    state.phase    = 'setup';
    state.rollen   = [];
    state.aktIdx   = 0;
    state.gezeigt  = false;
    state.stimmen  = {};
    state.stimmIdx = 0;
    render();
  },

};

function render() {
  renderImposter(state, handlers);
}

// Start
render();
