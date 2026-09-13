#!/usr/bin/env node
/**
 * Zeichnet die Diagramme unter docs/prozess/ als SVG nach docs/bilder/.
 *
 * Zwei Quellen, zwei Zeichner, kein Werkzeug außerhalb von npm:
 *
 *   docs/prozess/*.dot          Graphviz über @viz-js/viz (WebAssembly). Legt
 *                               Kanten so, dass sie nicht kreuzen, wo sie
 *                               nicht müssen; Mermaid konnte das für diese
 *                               Graphen nicht, und GitHub zeigte seine hellen
 *                               Kästen im dunklen Modus falsch.
 *   docs/prozess/*.bpmn         bpmn-js in einem Chromium ohne Fenster. Die
 *                               BPMN-Datei trägt ihr Layout schon (Pool, Bahnen,
 *                               Koordinaten); hier wird es nur gezeichnet.
 *
 * Die SVGs gehören ins Repo, weil GitHub sie als Bild zeigt, eine .dot- oder
 * .bpmn-Datei aber als Text. Wer eine Quelle ändert, zeichnet neu:
 *
 *   node scripts/diagramme-zeichnen.mjs
 *
 * `node scripts/diagramme-zeichnen.mjs --pruefen` zeichnet in den Speicher
 * und vergleicht mit dem Stand im Repo; das ist das Gate.
 */

import { createRequire } from 'node:module'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { instance } from '@viz-js/viz'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QUELLEN = path.join(WURZEL, 'docs', 'prozess')
const ZIEL = path.join(WURZEL, 'docs', 'bilder')
const PRUEFEN = process.argv.includes('--pruefen')

// Playwright liegt bei `oberflaeche/`, wo es für die E2E-Tests ohnehin da ist.
const hole = createRequire(path.join(WURZEL, 'oberflaeche', 'package.json'))

async function zeichneDot(datei) {
  const viz = await instance()
  const quelle = await readFile(datei, 'utf8')
  return viz.renderString(quelle, { format: 'svg' })
}

/**
 * bpmn-js braucht ein DOM; ein Chromium ohne Fenster liefert es. Die
 * Bibliothek wird als Text in die Seite gelegt, damit nichts aus dem Netz
 * kommt und das Bild auf jedem Rechner dasselbe ist.
 */
async function zeichneBpmn(datei) {
  const { chromium } = hole('playwright')
  const bibliothek = await readFile(
    path.join(WURZEL, 'node_modules', 'bpmn-js', 'dist', 'bpmn-viewer.production.min.js'),
    'utf8'
  )
  const xml = await readFile(datei, 'utf8')
  const browser = await chromium.launch()
  try {
    const seite = await browser.newPage()
    await seite.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
        html, body, #leinwand { margin: 0; width: 1600px; height: 1000px; }
      </style></head><body><div id="leinwand"></div></body></html>`
    )
    await seite.addScriptTag({ content: bibliothek })
    const svg = await seite.evaluate(async (xml) => {
      const viewer = new window.BpmnJS({ container: '#leinwand' })
      await viewer.importXML(xml)
      const { svg } = await viewer.saveSVG()
      return svg
    }, xml)
    return mitFestenMarken(svg)
  } finally {
    await browser.close()
  }
}

/**
 * bpmn-js vergibt den Pfeilspitzen bei jedem Lauf neue Zufallsnamen. Für das
 * Bild ist das egal, für das Gate nicht: Es vergleicht Bytes. Die Namen werden
 * deshalb in der Reihenfolge ihres Auftretens durchnummeriert.
 */
function mitFestenMarken(svg) {
  const namen = [...new Set(svg.match(/marker-[a-z0-9]+/g) ?? [])]
  return namen.reduce((text, name, i) => text.replaceAll(name, `marker-${i + 1}`), svg)
}

const RAND = 30

/**
 * Das gezeichnete SVG bekommt einen Rand und eine helle Fläche.
 *
 * Der Rand, weil bpmn-js den Ausschnitt eng um die Formen legt und Rückwege,
 * die außen am Pool entlanglaufen, sonst am Bildrand abgeschnitten sind. Die
 * helle Fläche, weil GitHub im dunklen Modus sonst dunkle Schrift auf
 * dunklem Grund zeigt; Graphviz malt sie selbst, bpmn-js nicht.
 */
function mitRandUndHellemGrund(svg) {
  const treffer = svg.match(/<svg[^>]*\sviewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"[^>]*>/)
  if (!treffer) return svg
  const [x, y, b, h] = treffer.slice(1, 5).map(Number)
  const kopf = treffer[0]
    .replace(/\sviewBox="[^"]*"/, ` viewBox="${x - RAND} ${y - RAND} ${b + 2 * RAND} ${h + 2 * RAND}"`)
    .replace(/\swidth="[^"]*"/, ` width="${b + 2 * RAND}"`)
    .replace(/\sheight="[^"]*"/, ` height="${h + 2 * RAND}"`)
  const grund = `<rect x="${x - RAND}" y="${y - RAND}" width="${b + 2 * RAND}" height="${h + 2 * RAND}" fill="white"/>`
  return svg.replace(treffer[0], kopf + grund)
}

async function main() {
  await mkdir(ZIEL, { recursive: true })
  const dateien = (await readdir(QUELLEN)).filter((d) => /\.(dot|bpmn)$/.test(d)).sort()
  if (!dateien.length) {
    console.log(`Keine Quellen unter ${path.relative(WURZEL, QUELLEN)}.`)
    return 1
  }
  let fehler = 0
  for (const datei of dateien) {
    const quelle = path.join(QUELLEN, datei)
    const name = datei.replace(/\.(dot|bpmn)$/, '')
    const ziel = path.join(ZIEL, `${datei.endsWith('.bpmn') ? 'prozesslandschaft' : name}.svg`)
    try {
      const roh = datei.endsWith('.dot') ? await zeichneDot(quelle) : await zeichneBpmn(quelle)
      const svg = mitRandUndHellemGrund(roh).trimEnd() + '\n'
      if (PRUEFEN) {
        const bisher = await readFile(ziel, 'utf8').catch(() => null)
        if (bisher !== svg) {
          fehler += 1
          console.log(`  ALT   ${path.relative(WURZEL, ziel)} passt nicht zu ${datei}; neu zeichnen`)
          continue
        }
        console.log(`  ok    ${path.relative(WURZEL, ziel)} entspricht ${datei}`)
      } else {
        await writeFile(ziel, svg, 'utf8')
        console.log(`  ok    ${path.relative(WURZEL, ziel)}  aus ${datei}`)
      }
    } catch (e) {
      fehler += 1
      console.log(`  ROT   ${datei}: ${e.message.split('\n')[0]}`)
    }
  }
  console.log(`${dateien.length - fehler} von ${dateien.length} Diagrammen ${PRUEFEN ? 'auf Stand' : 'gezeichnet'}.`)
  return fehler ? 1 : 0
}

process.exit(await main())
