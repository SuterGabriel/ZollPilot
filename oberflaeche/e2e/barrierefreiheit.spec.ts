// Barrierefreiheit wird geprüft, nicht behauptet (docs/ARBEITSWEISE.md).
//
// axe läuft über jede Ansicht: das leere Formular, das Formular mit Belegen,
// das Ergebnis und den Fehlerfall. Dazu die Dinge, die axe nicht sieht —
// Tastaturbedienung und wohin der Fokus nach dem Absenden wandert.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI } from '../src/app/akte/testhilfen';

const DATEINAMEN = ['handelsrechnung.pdf', 'packliste.pdf', 'bill-of-lading.pdf'];
const MAX_EBENEN = 6;

/**
 * Die echten Testbelege aus dem Repo, nicht erfundene Bytes: Wer die
 * Oberfläche prüft, soll dieselben PDFs schicken wie der Rauchtest.
 *
 * Der Weg dorthin wird gesucht, nicht gezählt. `import.meta` gibt es nicht
 * (Playwright übersetzt nach CommonJS), das Arbeitsverzeichnis hängt davon
 * ab, von wo gestartet wurde, und `config.rootDir` zeigt auf `e2e/`. Eine
 * feste Zahl von Ebenen wäre eine Annahme, die beim nächsten Verschieben
 * stillschweigend bricht.
 */
function belegPfade(): string[] {
  let pfad = test.info().config.rootDir;
  for (let ebene = 0; ebene < MAX_EBENEN; ebene += 1) {
    const ordner = join(pfad, 'testdaten', 'belege', 'happy-path');
    if (existsSync(ordner)) return DATEINAMEN.map((name) => join(ordner, name));
    pfad = dirname(pfad);
  }
  throw new Error(`testdaten/belege/happy-path nicht gefunden, ausgehend von ${test.info().config.rootDir}`);
}

/** WCAG 2.1 AA plus die Regeln zu Best Practices, die axe getrennt führt. */
const MASSSTAB = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function keineVerstoesse(seite: Page, wo: string) {
  const bericht = await new AxeBuilder({ page: seite }).withTags(MASSSTAB).analyze();
  const befunde = bericht.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}x — ${v.help}`);
  expect(befunde, `axe-Verstöße in ${wo}:\n${befunde.join('\n')}`).toEqual([]);
}

/** Fängt den Webhook ab und antwortet mit einem Prüfstück. */
async function antworteMit(seite: Page, ergebnis: unknown, status: number) {
  await seite.route('**/webhook/belege', async (weg) => {
    await weg.fulfill({ status, contentType: 'application/json', body: JSON.stringify(ergebnis) });
  });
}

async function belegeAblegen(seite: Page) {
  await seite.locator('#beleg-eingabe').setInputFiles(belegPfade());
  await expect(seite.getByText('3 Belege bereit zum Einreichen.')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Prüfakte' })).toBeVisible();
});

test('das leere Formular ist ohne axe-Verstoß', async ({ page }) => {
  await keineVerstoesse(page, 'leeres Formular');
});

test('das Formular mit Belegen ist ohne axe-Verstoß', async ({ page }) => {
  await belegeAblegen(page);
  await keineVerstoesse(page, 'Formular mit Belegen');
});

test('eine blockierte Akte wird ohne axe-Verstoß dargestellt', async ({ page }) => {
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();

  await expect(page.getByRole('heading', { name: 'Ergebnis der Prüfung' })).toBeVisible();
  await expect(page.locator('.band.blockiert .wort')).toHaveText('Blockiert');
  await keineVerstoesse(page, 'Ergebnis blockiert');
});

test('eine freigabereife Akte wird ohne axe-Verstoß dargestellt', async ({ page }) => {
  await antworteMit(page, ERGEBNIS_FREI, 200);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();

  await expect(page.locator('.band.freigabereif .wort')).toHaveText('Freigabereif');
  await keineVerstoesse(page, 'Ergebnis freigabereif');
});

test('ein Transportfehler wird ohne axe-Verstoß dargestellt', async ({ page }) => {
  await page.route('**/webhook/belege', (weg) => weg.abort('failed'));
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();

  await expect(page.getByRole('heading', { name: 'Prüfung nicht durchgeführt' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('docker compose');
  // Kein Ergebnisblock — auch kein leerer (Entwurf, Zustand 9).
  await expect(page.locator('section.block')).toHaveCount(0);
  await keineVerstoesse(page, 'Fehlerfall');
});

test('der Fokus wandert nach dem Absenden auf die Überschrift des Ergebnisses', async ({ page }) => {
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();

  await expect(page.getByRole('heading', { name: 'Ergebnis der Prüfung' })).toBeFocused();
});

test('die Sprungmarke ist der erste Halt und führt zum Ergebnis', async ({ page }) => {
  await page.keyboard.press('Tab');
  const marke = page.getByRole('link', { name: 'Zum Ergebnis springen' });
  await expect(marke).toBeFocused();
  await expect(marke).toBeVisible();
  await marke.press('Enter');
  await expect(page).toHaveURL(/#ergebnis$/);
});

test('Belege lassen sich ohne Zeigegerät auswählen und wieder entfernen', async ({ page }) => {
  await belegeAblegen(page);
  const entfernen = page.getByRole('button', { name: /Entfernen.*handelsrechnung\.pdf/ });
  await entfernen.focus();
  await expect(entfernen).toBeFocused();
  await entfernen.press('Enter');
  await expect(page.getByText('2 Belege bereit zum Einreichen.')).toBeVisible();
});

test('ohne Beleg ist das Absenden gesperrt und der Grund steht daneben', async ({ page }) => {
  const knopf = page.getByRole('button', { name: 'Akte einreichen' });
  await expect(knopf).toBeDisabled();
  await expect(page.locator('#sperrgrund')).toContainText('Mindestens ein Beleg wird gebraucht.');
});

test('eine Datei, die kein PDF ist, wird abgelehnt und genannt', async ({ page }) => {
  await page.locator('#beleg-eingabe').setInputFiles({
    name: 'notiz.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('kein PDF'),
  });
  await expect(page.getByRole('alert')).toContainText('notiz.txt');
  await expect(page.getByRole('button', { name: 'Akte einreichen' })).toBeDisabled();
});

test('die Ergebnisblöcke stehen nach Handlungsnähe', async ({ page }) => {
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();

  // `allTextContents`, nicht `allInnerTexts`: Chrome wendet bei `innerText`
  // das `text-transform: uppercase` der Rubrik an, `textContent` nicht.
  const rubriken = await page.locator('section.block h3').allTextContents();
  expect(rubriken.map((t) => t.trim().split(/\s+/)[0])).toEqual([
    'Nachforderungen',
    'Regeln',
    'Nachweispflichten',
    'Erkannte',
  ]);
});

test('ein entwertetes Ergebnis wird als entwertet gezeigt, nicht gelöscht', async ({ page }) => {
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();
  await expect(page.locator('.band.blockiert')).toBeVisible();

  // Ein Beleg entfernen: Das Ergebnis gehörte zu einer anderen Zusammenstellung.
  await page.getByRole('button', { name: /Entfernen.*packliste\.pdf/ }).click();
  await expect(page.getByRole('heading', { name: 'Vorheriges Ergebnis gilt nicht mehr' })).toBeVisible();
  await expect(page.locator('section.block')).toHaveCount(0);
  await keineVerstoesse(page, 'entwertetes Ergebnis');
});
