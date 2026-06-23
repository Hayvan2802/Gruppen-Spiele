/* ============================================
   GRUPPEN-SPIELE – App Controller
   Version: 1.1.0
   Neu: Timer (45 Sekunden Diskussionsrunde)
   ============================================ */

const TIMER_SEKUNDEN = 45;

const state = {
  phase:          'setup',
  namen:          [],
  eingabe:        '',
  imposterAnzahl: 1,
  rollen:         [],
  aktIdx:         0,
  gezeigt:        false,
  stimmen:        {},
  stimmIdx:       0,
  // Timer
  timerAktiv:     false,
  timerSekunden:  TIMER_SEKUNDEN,
  timerInterval:  null,
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
    state.rollen          = createRoles(state.namen, state.imposterAnzahl);
    state.aktIdx          = 0;
    state.gezeigt         = false;
    state.stimmen         = {};
    state.stimmIdx        = 0;
    state.timerAktiv      = false;
    state.timerSekunden   = TIMER_SEKUNDEN;
    state.phase           = 'pass';
    clearInterval(state.timerInterval);
    render();
  },

  zeigen()     { state.gezeigt = true;  render(); },
  verstecken() { state.gezeigt = false; render(); },

  weiter() {
    clearInterval(state.timerInterval);
    if (state.aktIdx + 1 >= state.rollen.length) {
      // Alle haben ihre Karte gesehen → Timer-Screen vor Abstimmung
      state.phase         = 'timer';
      state.timerSekunden = TIMER_SEKUNDEN;
      state.timerAktiv    = true;
      render();
      handlers.timerStarten();
    } else {
      state.aktIdx++;
      state.gezeigt = false;
      render();
    }
  },

  timerStarten() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.timerSekunden--;
      renderTimer();
      if (state.timerSekunden <= 0) {
        clearInterval(state.timerInterval);
        state.timerAktiv = false;
        // Automatisch zur Abstimmung
        setTimeout(() => {
          state.phase    = 'voting';
          state.stimmIdx = 0;
          render();
        }, 600);
      }
    }, 1000);
  },

  timerAbbrechen() {
    clearInterval(state.timerInterval);
    state.timerAktiv = false;
    state.phase      = 'voting';
    state.stimmIdx   = 0;
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
    clearInterval(state.timerInterval);
    state.phase         = 'setup';
    state.rollen        = [];
    state.aktIdx        = 0;
    state.gezeigt       = false;
    state.stimmen       = {};
    state.stimmIdx      = 0;
    state.timerAktiv    = false;
    state.timerSekunden = TIMER_SEKUNDEN;
    render();
  },

};

function render() {
  renderImposter(state, handlers);
}

// Start
render();
