import { expect } from '@playwright/test';

// Wartet bis der Splash-Screen verschwunden ist und die App vollständig bereit ist.
// Behandelt auch das WhatsNew-Modal, das mit 800ms Verzögerung erscheinen kann.
export async function waitForApp(page) {
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveClass(/fade-out/, { timeout: 10000 });
  // WICHTIG: Das "Was ist neu"-Modal (erscheint bis ~800ms nach Start) ZUERST
  // schließen — solange es offen ist, sind die Spiel-Karten per v-if ausgeblendet.
  // (Vorher wurde erst auf die Karte gewartet → Race → flaky.)
  const modal = page.locator('.modal-bg');
  const appeared = await modal.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
  if (appeared) {
    await page.locator('.modal-bg .btn-start').click();
    await modal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
  // Jetzt ist das Vue-Rendering der Startseite fertig: Werwolf-Karte sichtbar.
  await expect(page.locator('.game-select-card', { hasText: 'Werwolf' })).toBeVisible({ timeout: 6000 });
}

// Öffnet ein Spiel über seine Karte auf der Startseite.
export async function openGame(page, name) {
  await page.locator('.game-select-card', { hasText: name }).click();
}

// ── Gemeinsame Ablauf-Helfer für die Voll-Durchlauf-Tests (Handy-Simulation) ──

// Imposter/„Wer bin ich?": Setup-Spielernamen ausfüllen. Gibt die Namen zurück.
export async function fillPlayerNames(page, names) {
  const inputs = page.locator('.ninput');
  const count = await inputs.count();
  const used = [];
  for (let i = 0; i < count; i++) {
    const name = names[i] || ('Spieler ' + (i + 1));
    await inputs.nth(i).fill(name);
    used.push(name);
  }
  return used;
}

// Imposter: alle Reveal-Karten der Reihe nach aufdecken und weiterklicken,
// bis der Timer-Screen erscheint (letzter Button = „Diskussion starten").
// Als kleine Zustandsmaschine umgesetzt, damit Flip-Animationen/Übergänge
// zwischen den Spielern nicht zu Race-Conditions führen.
export async function completeImposterReveal(page) {
  await page.locator('.rev-card').waitFor({ state: 'visible' });
  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('.timer-skip-btn').isVisible().catch(() => false)) return;
    const next = page.locator('.btn-next-reveal');
    if (await next.isVisible().catch(() => false)) {
      await next.click();                        // Weiter / Diskussion starten
    } else if (await page.locator('.rev-card .card-back').isVisible().catch(() => false)) {
      await page.locator('.rev-card').click();   // Karte aufdecken
    } else {
      await page.waitForTimeout(100);            // Übergang abwarten
    }
  }
  throw new Error('Imposter-Reveal nicht abgeschlossen (Timer-Screen nicht erreicht)');
}

// Imposter: die (mehrrundige) Abstimmung komplett durchspielen, bis der
// terminale Ergebnis-Screen erreicht ist. Deckt alle Zwischenzustände ab:
// Abstimmung, Zwischenergebnis (Imposter noch da → weiter), Gerät-weitergeben
// und Stichwahl bei Gleichstand. Es wird immer der erste Kandidat gewählt;
// dadurch fliegen nach und nach Spieler raus, bis das Spiel eindeutig endet
// (Dorf gewinnt oder Imposter erreicht Gleichstand). Der Ergebnis-Screen ist
// am eindeutigen `.confetti`-Element erkennbar (nur dort im DOM).
export async function completeImposterVoting(page) {
  for (let guard = 0; guard < 80; guard++) {
    if (await page.locator('.confetti').count() > 0) return;    // Ergebnis-Screen
    const option = page.locator('.voting-option').first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      const confirm = page.locator('.voting-confirm-btn');
      if (await confirm.isEnabled().catch(() => false)) await confirm.click();
      continue;
    }
    const cont = page.locator('button', { hasText: /Weiter →/ });            // Zwischenergebnis
    if (await cont.isVisible().catch(() => false)) { await cont.click(); continue; }
    const startVote = page.locator('button', { hasText: /Abstimmung starten/ }); // Pause
    if (await startVote.isVisible().catch(() => false)) { await startVote.click(); continue; }
    const runoff = page.locator('button', { hasText: /Stichwahl starten/ });  // Gleichstand
    if (await runoff.isVisible().catch(() => false)) { await runoff.click(); continue; }
    await page.waitForTimeout(100);
  }
  throw new Error('Imposter-Abstimmung nicht terminiert (Ergebnis-Screen nicht erreicht)');
}

// Wechselt ein Spiel (Imposter/Codenames/Wer bin ich?) in den Multiplayer-Modus.
// Die zweite Modus-Karte ist „Multiplayer" (coop).
export async function switchToMultiplayer(page) {
  await page.locator('.mode-card').first().waitFor({ state: 'visible' });
  await page.locator('.mode-card').nth(1).click();
}
