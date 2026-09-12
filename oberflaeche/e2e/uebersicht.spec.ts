// Der zweite Bildschirm, geprüft wie der erste: axe über jede Ansicht,
// Tastatur, und dass ein Fehler keine leere Tabelle hinterlässt.

import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

import { UEBERSICHT, UEBERSICHT_LEER } from '../src/app/uebersicht/testhilfen';

const MASSSTAB = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function keineVerstoesse(seite: Page, wo: string) {
  const bericht = await new AxeBuilder({ page: seite }).withTags(MASSSTAB).analyze();
  const befunde = bericht.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}x: ${v.help}`);
  expect(befunde, `axe-Verstöße in ${wo}:\n${befunde.join('\n')}`).toEqual([]);
}

async function liefere(seite: Page, daten: unknown, status = 200) {
  let aufrufe = 0;
  await seite.route('**/webhook/akten', async (weg) => {
    aufrufe += 1;
    await weg.fulfill({ status, contentType: 'application/json', body: JSON.stringify(daten) });
  });
  return () => aufrufe;
}

test('die Übersicht ist über die Navigation erreichbar und ohne axe-Verstoß', async ({ page }) => {
  await liefere(page, UEBERSICHT);
  await page.goto('/');
  await page.getByRole('link', { name: 'Übersicht' }).click();
  await expect(page).toHaveURL(/\/uebersicht$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Übersicht' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Übersicht' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('row', { name: /ZP-2026-0002/ })).toBeVisible();
  await keineVerstoesse(page, 'Übersicht mit Daten');
});

test('leer und im Fehlerfall bleibt sie erklärt, nicht leer', async ({ page }) => {
  await liefere(page, UEBERSICHT_LEER);
  await page.goto('/uebersicht');
  await expect(page.getByText('Noch keine Akte geprüft.')).toBeVisible();
  await keineVerstoesse(page, 'Übersicht leer');

  await page.unroute('**/webhook/akten');
  await liefere(page, { fehler: true }, 500);
  await page.getByRole('button', { name: 'Neu laden' }).click();
  await expect(page.getByRole('alert')).toContainText('500');
  await expect(page.getByText('Nicht bekannt, weil das Laden gescheitert ist.').first()).toBeVisible();
  await keineVerstoesse(page, 'Übersicht mit Fehler');
});

test('Neu laden geht ohne Zeigegerät und fragt den Webhook erneut', async ({ page }) => {
  const aufrufe = await liefere(page, UEBERSICHT);
  await page.goto('/uebersicht');
  await expect(page.getByRole('row', { name: /ZP-2026-0001/ })).toBeVisible();
  const knopf = page.getByRole('button', { name: 'Neu laden' });
  await knopf.focus();
  await expect(knopf).toBeFocused();
  await knopf.press('Enter');
  await expect.poll(aufrufe).toBe(2);
});

test('die Seite scrollt auch in der Übersicht nie waagerecht', async ({ page }) => {
  await liefere(page, UEBERSICHT);
  for (const width of [400, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/uebersicht');
    await expect(page.getByRole('row', { name: /ZP-2026-0002/ })).toBeVisible();
    const quer = await page.evaluate(() => {
      const w = document.scrollingElement ?? document.documentElement;
      return w.scrollWidth <= w.clientWidth;
    });
    expect(quer, `waagerechter Rollbalken bei ${width} px`).toBe(true);
  }
});
