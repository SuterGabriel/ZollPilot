// Barrierefreiheit wird geprüft, nicht behauptet (docs/ARBEITSWEISE.md).
//
// axe läuft über jede Ansicht: das leere Formular, das Formular mit Belegen,
// das Ergebnis und den Fehlerfall. Dazu die Dinge, die axe nicht sieht:
// Tastaturbedienung und wohin der Fokus nach dem Absenden wandert.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { ERGEBNIS_BLOCKIERT, ERGEBNIS_FREI, ERGEBNIS_UEBERSTEUERT } from '../src/app/akte/testhilfen';

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
  const befunde = bericht.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}x: ${v.help}`);
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
  // Kein Ergebnisblock, auch kein leerer (Entwurf, Zustand 9).
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

test('ein Befund lässt sich übersteuern, ohne dass er verschwindet', async ({ page }) => {
  // Erst blockiert, nach der Übersteuerung antwortet der Workflow mit dem
  // zweiten Prüfstück, genau so, wie er es im Betrieb täte.
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();
  await expect(page.locator('.band.blockiert .wort')).toHaveText('Blockiert');

  await page.getByRole('button', { name: /^Übersteuern: TRN-01/ }).click();
  await keineVerstoesse(page, 'Übersteuerungsformular');

  await page.getByLabel('Ihr Name').fill('G. Suter');
  await page.getByLabel(/Begründung/).fill('Reederei hat den Umlad schriftlich bestätigt');

  await antworteMit(page, ERGEBNIS_UEBERSTEUERT, 200);
  await page.getByRole('button', { name: 'Übersteuern und erneut prüfen' }).click();

  // Die Entscheidung dreht, der Befund bleibt stehen (ADR-007).
  await expect(page.locator('.band.freigabereif .wort')).toHaveText('Freigabereif');
  await expect(page.locator('.unterschied')).toContainText('Das Regelwerk allein sagt');
  await expect(page.locator('.befunde .status').first()).toHaveText('verletzt');
  await expect(page.getByText('Verantwortet von G. Suter')).toBeVisible();
  await keineVerstoesse(page, 'übersteuerter Befund');
});

test('ohne Namen oder Begründung ist das Übersteuern gesperrt und der Grund steht daneben', async ({ page }) => {
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();
  await page.getByRole('button', { name: /^Übersteuern: TRN-01/ }).click();

  const absenden = page.getByRole('button', { name: 'Übersteuern und erneut prüfen' });
  await expect(absenden).toBeDisabled();
  await expect(page.locator('.sperre')).toHaveText('Ohne Namen keine Übersteuerung.');

  await page.getByLabel('Ihr Name').fill('G. Suter');
  await expect(page.locator('.sperre')).toContainText('mindestens 11 Zeichen');
  await expect(absenden).toBeDisabled();

  await page.getByLabel(/Begründung/).fill('Reederei hat bestätigt');
  await expect(absenden).toBeEnabled();
});

/**
 * Die Seite selbst scrollt nicht.
 *
 * Ab 1024 px füllt die Anwendung das Fenster; was länger wird, bewegt sich
 * in seiner Spalte. Der Grund steht in `app.css`: Wer einen Befund liest,
 * braucht die Akte daneben. Ohne diesen Test wäre das eine Absichtserklärung
 * Ein zusätzlicher Absatz im Kopf genügt, um sie zu brechen.
 */
async function seitenscrollung(seite: Page) {
  return seite.evaluate(() => {
    const wurzel = document.scrollingElement ?? document.documentElement;
    return { hoehe: wurzel.scrollHeight, sichtbar: wurzel.clientHeight };
  });
}

for (const groesse of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`die Seite scrollt nicht bei ${groesse.width}x${groesse.height}`, async ({ page }) => {
    await page.setViewportSize(groesse);
    const leer = await seitenscrollung(page);
    expect(leer.hoehe, `leeres Formular bei ${groesse.width}x${groesse.height}`).toBeLessThanOrEqual(leer.sichtbar);

    // Auch mit einem Ergebnis, das länger ist als das Fenster: Dann scrollt
    // die Ergebnisspalte, nicht die Seite.
    await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
    await belegeAblegen(page);
    await page.getByRole('button', { name: 'Akte einreichen' }).click();
    await expect(page.locator('.band .wort')).toBeVisible();

    const gefuellt = await seitenscrollung(page);
    expect(gefuellt.hoehe, `mit Ergebnis bei ${groesse.width}x${groesse.height}`).toBeLessThanOrEqual(gefuellt.sichtbar);

    // Und die Spalte bewegt sich wirklich; sonst wäre der Befund unerreichbar.
    const spalte = page.locator('.ergebnis-spalte');
    const beweglich = await spalte.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(beweglich, 'die Ergebnisspalte muss scrollen können').toBe(true);

    // Die Hauptaktion bleibt sichtbar, auch wenn die Karten darüber länger
    // sind als das Fenster. Eine abgeschnittene Schaltfläche ist der Grund,
    // aus dem dieser Test überhaupt existiert.
    await expect(page.getByRole('button', { name: 'Akte einreichen', exact: true })).toBeInViewport();
  });
}

test('bei 900 px Fensterhöhe braucht auch die Aktenspalte keinen Rollbalken', async ({ page }) => {
  // Die Grenze ist gemessen, nicht gewünscht: Bei 900 px passt die leere
  // Spalte mit etwa 16 px Spielraum, und den braucht sie. Auf Windows passte
  // sie einmal genau; auf dem Linux-Läufer der CI rendert Chromium mit
  // anderen Schriften sieben Pixel höher, und der Test war rot, bevor es
  // jemandem auf einem Bildschirm auffiel (app.css, Kopf und Fuß). Wird der
  // Kopf, eine Karte oder ein Abstand höher, fällt dieser Test wieder.
  // Darunter scrollt die Spalte; die Schaltfläche bleibt trotzdem stehen,
  // das prüfen die Tests darüber.
  await page.setViewportSize({ width: 1440, height: 900 });
  const spalte = await page
    .locator('.akte')
    .evaluate((el) => ({ inhalt: el.scrollHeight, sichtbar: el.clientHeight }));
  expect(spalte.inhalt, `Aktenspalte: ${spalte.inhalt} in ${spalte.sichtbar}`).toBeLessThanOrEqual(spalte.sichtbar);
});

test('unter 1024 px scrollt die Seite wieder, sonst wäre Inhalt unerreichbar', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 720 });
  await antworteMit(page, ERGEBNIS_BLOCKIERT, 422);
  await belegeAblegen(page);
  await page.getByRole('button', { name: 'Akte einreichen' }).click();
  await expect(page.locator('.band .wort')).toBeVisible();

  const gestapelt = await seitenscrollung(page);
  expect(gestapelt.hoehe).toBeGreaterThan(gestapelt.sichtbar);
  // Kein waagerechter Rollbalken: Das bleibt auch schmal die Bedingung.
  const quer = await page.evaluate(() => {
    const w = document.scrollingElement ?? document.documentElement;
    return w.scrollWidth <= w.clientWidth;
  });
  expect(quer, 'die Seite darf nie waagerecht scrollen').toBe(true);
});
