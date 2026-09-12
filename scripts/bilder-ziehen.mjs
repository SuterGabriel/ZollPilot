#!/usr/bin/env node
/**
 * Zieht Bilder aus dem laufenden Stack: jeden Workflow als PNG aus dem n8n-Editor.
 *
 * Eine Ausschreibung verlangt Prozesslandschaften und Datenflussdiagramme.
 * Die liegen als Mermaid und BPMN im Repo (docs/prozess/). Was fehlt, ist das
 * Bild, das ein Leser zuerst sucht: der Workflow so, wie er im Editor
 * aussieht. Von Hand abfotografiert veraltet es beim nächsten Commit,
 * deshalb dieses Skript: ein Befehl, sieben Bilder, jederzeit wiederholbar.
 *
 *   docker compose up -d --wait
 *   node scripts/bilder-ziehen.mjs
 *
 * Zugang: n8n 1.114 verlangt ein Owner-Konto und lässt sich nicht
 * abschalten (docs/BETRIEB.md). Die Anmeldedaten kommen aus der Umgebung,
 * nie aus einer versionierten Datei:
 *
 *   ZOLLPILOT_N8N_BENUTZER    E-Mail des Owner-Kontos
 *   ZOLLPILOT_N8N_PASSWORT    Passwort dazu
 *
 * Fehlt beides, legt das Skript beim ersten Lauf ein Konto an, wenn n8n noch
 * im Einrichtungsbildschirm steht, und sagt dann, was es gesetzt hat.
 *
 * Die Bilder liegen unter docs/bilder/ und gehören ins Repo: Sie sind
 * Dokumentation, kein Build-Artefakt. Wer einen Workflow ändert, zieht sie
 * neu. Ein Gate, das ein fehlendes Bild meldet, kommt mit den ersten
 * Bildern; vorher hätte es nichts zu prüfen.
 */

import { createRequire } from 'node:module'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Playwright liegt bei `oberflaeche/`, nicht in der Wurzel: Dort wird es
// für die E2E-Tests ohnehin gebraucht, und zwei Installationen desselben
// Browsers wären ein halbes Gigabyte für nichts.
const hole = createRequire(path.join(WURZEL, 'oberflaeche', 'package.json'))
const { chromium } = hole('playwright')

const BASIS = process.argv[2] ?? process.env.ZOLLPILOT_N8N_BASIS ?? 'http://localhost:5678'
const ZIEL = path.join(WURZEL, 'docs', 'bilder')
const BENUTZER = process.env.ZOLLPILOT_N8N_BENUTZER ?? 'zollpilot@zollpilot.test'
const PASSWORT = process.env.ZOLLPILOT_N8N_PASSWORT ?? 'ZollPilot-dev-2026'
const BREITE = 1600
const HOEHE = 1000
// Nach dem Einpassen rückt n8n die Knoten noch; ohne diese Pause zeigt das
// Bild eine halb fertige Bewegung.
const RUHE_MS = 900

/** Die Workflows in der Reihenfolge, in der sie im Repo liegen. */
async function workflows() {
  const ordner = path.join(WURZEL, 'workflows')
  const dateien = (await readdir(ordner)).filter((d) => d.endsWith('.json')).sort()
  const gelesen = []
  for (const datei of dateien) {
    const inhalt = JSON.parse(await readFile(path.join(ordner, datei), 'utf8'))
    if (!inhalt.id) throw new Error(`${datei}: kein id-Feld, ohne das ist der Editor nicht adressierbar`)
    gelesen.push({ id: inhalt.id, name: inhalt.name ?? inhalt.id, datei })
  }
  return gelesen
}

/**
 * Anmelden, notfalls das Owner-Konto anlegen.
 *
 * n8n zeigt beim allerersten Aufruf einen Einrichtungsbildschirm statt der
 * Anmeldung. Beides wird hier bedient, damit ein frischer Stack nicht von
 * Hand angefasst werden muss.
 */
async function anmelden(seite) {
  await seite.goto(`${BASIS}/signin`, { waitUntil: 'domcontentloaded' })
  await seite.waitForTimeout(500)

  if (seite.url().includes('/setup')) {
    console.log(`  neu   Owner-Konto ${BENUTZER} wird angelegt`)
    await seite.fill('input[name="email"]', BENUTZER)
    await seite.fill('input[name="firstName"]', 'ZollPilot')
    await seite.fill('input[name="lastName"]', 'Betrieb')
    await seite.fill('input[name="password"]', PASSWORT)
    await seite.getByRole('button', { name: /weiter|next|konto|account/i }).click()
    await seite.waitForTimeout(2000)
    return
  }

  const feld = seite.locator('input[name="email"]')
  if (await feld.count()) {
    await feld.fill(BENUTZER)
    await seite.fill('input[name="password"]', PASSWORT)
    await seite.getByRole('button', { name: /anmelden|sign in|login/i }).click()
    await seite.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 15000 })
  }
}

/** Den Zeichenbereich suchen; n8n benennt ihn je nach Fassung anders. */
async function zeichenflaeche(seite) {
  for (const wahl of ['[data-test-id="canvas"]', '.vue-flow', '#node-view', '[data-test-id="node-view"]']) {
    const treffer = seite.locator(wahl).first()
    if (await treffer.count()) return treffer
  }
  return null
}

async function main() {
  await mkdir(ZIEL, { recursive: true })
  const liste = await workflows()
  const browser = await chromium.launch()
  const kontext = await browser.newContext({ viewport: { width: BREITE, height: HOEHE }, deviceScaleFactor: 2 })
  const seite = await kontext.newPage()
  let fehler = 0

  try {
    try {
      await anmelden(seite)
    } catch (e) {
      console.log(`KEIN STACK unter ${BASIS}: ${e.message.split('\n')[0]}`)
      console.log('Erst `docker compose up -d --wait`, dann noch einmal. Es wird nichts gezeichnet.')
      return 1
    }
    for (const { id, name, datei } of liste) {
      const ziel = path.join(ZIEL, `workflow-${id}.png`)
      try {
        await seite.goto(`${BASIS}/workflow/${id}`, { waitUntil: 'networkidle', timeout: 30000 })
        const flaeche = await zeichenflaeche(seite)
        if (!flaeche) throw new Error('kein Zeichenbereich gefunden; n8n-Fassung geprüft?')
        // `1` ist in n8n das Kürzel für "alles einpassen". Ohne das zeigt
        // das Bild den zuletzt gespeicherten Ausschnitt, nicht den Workflow.
        await seite.keyboard.press('1')
        await seite.waitForTimeout(RUHE_MS)
        await flaeche.screenshot({ path: ziel })
        console.log(`  ok    ${path.relative(WURZEL, ziel)}  (${name})`)
      } catch (e) {
        fehler += 1
        console.log(`  ROT   ${datei}: ${e.message}`)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`${liste.length - fehler} von ${liste.length} Workflows als Bild.`)
  return fehler ? 1 : 0
}

process.exit(await main())
