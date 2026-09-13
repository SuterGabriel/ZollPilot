#!/usr/bin/env node
/**
 * Rendert die Projektdokumentation zu einem PDF.
 *
 *   node docs/projektdokumentation/rendern.mjs
 *
 * Titelseite und Innenseiten sind zwei HTML-Dateien, weil die Titelseite
 * ohne Kopf- und Fußzeile gesetzt wird und die Innenseiten mit. Beide werden
 * in demselben Chromium gerendert, das die Oberfläche für ihre E2E-Tests
 * mitbringt, und mit pdf-lib zu einer Datei zusammengefügt. Die Schriften
 * kommen von Google Fonts; ohne Netz fällt Chromium auf die Ersatzschriften
 * aus dem Stylesheet zurück.
 */

import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { PDFDocument } from 'pdf-lib'

const HIER = path.dirname(fileURLToPath(import.meta.url))
const WURZEL = path.resolve(HIER, '..', '..')
const ZIEL = path.join(HIER, 'ZollPilot-Projektdokumentation.pdf')

const hole = createRequire(path.join(WURZEL, 'oberflaeche', 'package.json'))
const { chromium } = hole('playwright')

const KOPF = `<div style="width:100%;font-family:Lato,Helvetica,Arial,sans-serif;font-size:7pt;color:#94a3b8;
  padding:0 16mm;display:flex;justify-content:space-between;">
  <span>ZollPilot · Projektdokumentation</span><span>Stand: September 2026</span></div>`
const FUSS = `<div style="width:100%;font-family:Lato,Helvetica,Arial,sans-serif;font-size:7pt;color:#94a3b8;
  padding:0 16mm;display:flex;justify-content:space-between;">
  <span>Gabriel Suter · kontakt@gabrielsuter.dev</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`

async function seiteLaden(browser, datei) {
  const seite = await browser.newPage()
  await seite.goto(pathToFileURL(path.join(HIER, datei)).href, { waitUntil: 'networkidle' })
  await seite.evaluate(() => document.fonts.ready)
  await seite.waitForTimeout(300)
  return seite
}

async function main() {
  const browser = await chromium.launch()
  try {
    const titel = await seiteLaden(browser, 'titel.html')
    const titelPdf = await titel.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })

    const inhalt = await seiteLaden(browser, 'index.html')
    const inhaltPdf = await inhalt.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: KOPF,
      footerTemplate: FUSS,
      margin: { top: '20mm', right: '16mm', bottom: '18mm', left: '16mm' },
    })

    const ganz = await PDFDocument.create()
    for (const teil of [titelPdf, inhaltPdf]) {
      const quelle = await PDFDocument.load(teil)
      const seiten = await ganz.copyPages(quelle, quelle.getPageIndices())
      seiten.forEach((s) => ganz.addPage(s))
    }
    ganz.setTitle('ZollPilot · Projektdokumentation')
    ganz.setAuthor('Gabriel Suter')
    ganz.setSubject('Vollständigkeits- und Konsistenzprüfung von Zoll- und Versanddokumenten mit n8n')
    await writeFile(ZIEL, await ganz.save())
    console.log(`  ok    ${path.relative(WURZEL, ZIEL)}: ${ganz.getPageCount()} Seiten`)
  } finally {
    await browser.close()
  }
}

await main()
