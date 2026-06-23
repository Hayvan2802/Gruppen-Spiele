/* ============================================
   IMPOSTER – UI / Rendering
   Version: 1.1.0
   Neu: Timer-Screen zwischen Pass & Voting
   ============================================ */

function renderImposter(state, handlers) {
  const app = document.getElementById('app');
  const { phase } = state;

  if (phase === 'setup')  { app.innerHTML = renderSetup(state); }
  if (phase === 'pass')   { app.innerHTML = renderPass(state); }
  if (phase === 'timer')  { app.innerHTML = renderTimerScreen(state); }
  if (phase === 'voting') { app.innerHTML = renderVoting(state); }
  if (phase === 'result') { app.innerHTML = renderResult(state); }

  bindEvents(state, handlers);
}

/* ---- Globale Timer-Update Funktion (ohne komplettes Re-Render) ---- */
function renderTimer() {
  const s = window._imposterState || state;
  const sek = s.timerSekunden;
  const total = 45;
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - sek / total);

  const numEl  = document.getElementById('timer-num');
  const fillEl = document.getElementById('timer-fill');
  const ringEl = document.getElementById('timer-ring');

  if (!numEl) return;

  numEl.textContent = sek;

  // Farbe je nach Zeit
  let color = '#a78bfa';
  if (sek <= 10) color = '#ef4444';
  else if (sek <= 20) color = '#f59e0b';

  if (fillEl) {
    fillEl.style.strokeDasharray  = circ;
    fillEl.style.strokeDashoffset = offset;
    fillEl.style.stroke = color;
  }
  if (numEl) numEl.style.color = color;

  // Puls-Animation wenn Zeit knapp
  if (ringEl && sek <= 10) {
    ringEl.style.transform = 'scale(1.05)';
    setTimeout(() => { if(ringEl) ringEl.style.transform = 'scale(1)'; }, 200);
  }
}

/* ---- Setup ---- */
function renderSetup(state) {
  const { namen, imposterAnzahl } = state;

  const spielerListe = namen.map((n, i) => `
    <div class="player-tag">
      <span class="player-tag__name">${n}</span>
      <button class="player-tag__delete" data-remove="${i}">×</button>
    </div>
  `).join('');

  return `
    <div class="card">
      <h2 style="font-size:19px;font-weight:700;margin-bottom:18px;color:#e2d9f3">👥 Spieler hinzufügen</h2>
      <div id="spieler-liste">${spielerListe}</div>
      <input id="name-input" class="input" type="text" placeholder="Name eingeben..." autocomplete="off" />
      <button class="btn btn-ghost" id="btn-add">+ Spieler hinzufügen</button>
      <div class="divider"></div>
      <div class="label-small">🕵️ Anzahl Imposter: ${imposterAnzahl}</div>
      <div class="imposter-count">
        <button class="count-btn ${imposterAnzahl === 1 ? 'active' : ''}" data-imposter="1">1</button>
        <button class="count-btn ${imposterAnzahl === 2 ? 'active' : ''}" data-imposter="2">2</button>
      </div>
      <button class="btn btn-primary" id="btn-start" style="margin-top:20px" ${namen.length < 3 ? 'disabled' : ''}>
        🎮 Spiel starten
      </button>
      ${namen.length < 3 ? '<div class="hint">Mindestens 3 Spieler benötigt</div>' : ''}
    </div>
  `;
}

/* ---- Pass ---- */
function renderPass(state) {
  const { rollen, aktIdx, gezeigt } = state;
  const sp    = rollen[aktIdx];
  const total = rollen.length;
  const pct   = ((aktIdx / total) * 100).toFixed(0);
  const isLast = aktIdx + 1 >= total;

  return `
    <div class="card center">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="hint" style="margin-bottom:8px">${aktIdx + 1} von ${total}</div>
      <div style="font-size:54px;margin:10px 0">📱</div>
      <div class="pass-name">${sp.name}</div>
      <div class="pass-hint">
        Gib das Handy an <strong style="color:#c4b5fd">${sp.name}</strong> weiter.<br>
        Alle anderen wegschauen! 👀
      </div>
      ${!gezeigt ? `
        <button class="btn btn-primary" id="btn-show">👁 Karte aufdecken</button>
      ` : `
        <div class="card-reveal ${sp.istImposter ? 'card-reveal--imposter' : 'card-reveal--normal'}">
          ${sp.istImposter ? `
            <div style="font-size:44px;margin-bottom:8px">🕵️</div>
            <span class="pill pill-red">DU BIST DER IMPOSTER!</span>
            <div class="card-reveal__sub--red">Du kennst das Wort nicht.<br>Tu so als ob – lass dich nicht erwischen!</div>
          ` : `
            <div class="label-small">Dein Wort</div>
            <div class="card-reveal__word">${sp.wort}</div>
            <div class="card-reveal__sub">Beschreibe es ohne das Wort zu sagen!</div>
          `}
        </div>
        <button class="btn btn-ghost" id="btn-hide">🙈 Karte verstecken</button>
        <button class="btn btn-primary" id="btn-next">
          ${isLast ? '▶ Diskussion starten' : '➡ Weiter'}
        </button>
      `}
    </div>
  `;
}

/* ---- Timer Screen ---- */
function renderTimerScreen(state) {
  const sek    = state.timerSekunden;
  const total  = 45;
  const radius = 38;
  const circ   = 2 * Math.PI * radius;
  const offset = circ * (1 - sek / total);

  return `
    <div class="card center">
      <div style="font-size:17px;font-weight:700;color:#e2d9f3;margin-bottom:6px">💬 Diskutiert!</div>
      <div style="color:#7c6f9f;font-size:13px;margin-bottom:4px">
        Wer verhält sich verdächtig?<br>Redet über das Wort – ohne es zu sagen!
      </div>

      <div class="timer-ring" id="timer-ring" style="transition:transform 0.2s">
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle class="timer-ring__track" cx="45" cy="45" r="${radius}"/>
          <circle id="timer-fill" class="timer-ring__fill"
            cx="45" cy="45" r="${radius}"
            stroke="#a78bfa"
            stroke-dasharray="${circ}"
            stroke-dashoffset="${offset}"
          />
        </svg>
        <span class="timer-ring__text" id="timer-num">${sek}</span>
      </div>

      <div style="color:#7c6f9f;font-size:12px;margin-bottom:18px">Sekunden</div>

      <button class="btn btn-ghost" id="btn-skip-timer" style="font-size:14px;padding:12px">
        Abstimmung jetzt starten →
      </button>
    </div>
  `;
}

/* ---- Voting ---- */
function renderVoting(state) {
  const { rollen, stimmIdx } = state;
  const abstimmender = rollen[stimmIdx];
  const pct = ((stimmIdx / rollen.length) * 100).toFixed(0);

  const optionen = rollen
    .filter(r => r.name !== abstimmender.name)
    .map(r => `<button class="vote-btn" data-vote="${r.name}">👤 ${r.name}</button>`)
    .join('');

  return `
    <div class="card">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="center" style="margin-bottom:20px">
        <div style="font-size:34px;margin-bottom:8px">🗳</div>
        <div style="font-size:19px;font-weight:700;margin-bottom:4px;color:#e2d9f3">Wer ist der Imposter?</div>
        <div style="color:#a78bfa;font-weight:700;font-size:16px">${abstimmender.name} stimmt ab</div>
        <div class="hint">${stimmIdx + 1} von ${rollen.length}</div>
      </div>
      ${optionen}
    </div>
  `;
}

/* ---- Result ---- */
function renderResult(state) {
  const { rollen, stimmen } = state;
  const { zaehlung, rausgeworfen, imposterNamen, imposterErwischt } = berechneErgebnis(rollen, stimmen);

  const stimmenRows = rollen.map(r => `
    <div class="result-row">
      <span>${r.name}${r.istImposter ? ' 🕵️' : ''}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="result-row__votes">${zaehlung[r.name] || 0}×</span>
        ${rausgeworfen.includes(r.name) ? '<span class="pill pill-purple">Raus</span>' : ''}
      </div>
    </div>
  `).join('');

  return `
    <div class="card center">
      <div style="font-size:54px;margin-bottom:12px">${imposterErwischt ? '🎉' : '🕵️'}</div>
      <div style="font-size:22px;font-weight:900;margin-bottom:4px">
        ${imposterErwischt ? 'Imposter erwischt!' : 'Imposter gewinnt!'}
      </div>
      <div style="color:#a78bfa;font-size:14px;margin-bottom:20px">
        ${imposterErwischt ? 'Die Gruppe hat gewonnen 🥳' : 'Der Imposter hat alle getäuscht 😈'}
      </div>
      <div class="result-box">
        <div class="label-small" style="margin-bottom:10px">Auflösung</div>
        <div style="margin-bottom:8px">
          <span style="color:var(--color-text-muted);font-size:13px">Das Wort war: </span>
          <strong style="color:#fff;font-size:18px">${rollen[0]?.wort}</strong>
        </div>
        <div style="margin-bottom:12px">
          <span style="color:var(--color-text-muted);font-size:13px">Imposter: </span>
          ${imposterNamen.map(n => `<span class="pill pill-red" style="margin-left:4px">${n}</span>`).join('')}
        </div>
        <div class="divider"></div>
        <div class="label-small" style="margin-bottom:8px">Stimmen</div>
        ${stimmenRows}
      </div>
      <button class="btn btn-primary" id="btn-restart">🔄 Neues Spiel</button>
    </div>
  `;
}

/* ---- Event Binding ---- */
function bindEvents(state, handlers) {
  const $ = id => document.getElementById(id);

  // Setup
  const nameInput = $('name-input');
  if (nameInput) {
    nameInput.addEventListener('input', e => { state.eingabe = e.target.value; });
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') handlers.hinzufuegen(); });
    setTimeout(() => nameInput.focus(), 50);
  }
  $('btn-add')?.addEventListener('click', handlers.hinzufuegen);
  $('btn-start')?.addEventListener('click', handlers.starten);
  document.querySelectorAll('[data-remove]').forEach(btn =>
    btn.addEventListener('click', () => handlers.entfernen(+btn.dataset.remove))
  );
  document.querySelectorAll('[data-imposter]').forEach(btn =>
    btn.addEventListener('click', () => handlers.setImposter(+btn.dataset.imposter))
  );

  // Pass
  $('btn-show')?.addEventListener('click', handlers.zeigen);
  $('btn-hide')?.addEventListener('click', handlers.verstecken);
  $('btn-next')?.addEventListener('click', handlers.weiter);

  // Timer
  $('btn-skip-timer')?.addEventListener('click', handlers.timerAbbrechen);

  // Voting
  document.querySelectorAll('[data-vote]').forEach(btn =>
    btn.addEventListener('click', () => handlers.abstimmen(btn.dataset.vote))
  );

  // Result
  $('btn-restart')?.addEventListener('click', handlers.neustart);
}
