#!/usr/bin/env node
// Kontrast-Check
//
// `docs/ARBEITSWEISE.md` verlangt für die Oberfläche: "Gestaltungstoken
// zuerst, mit den Kontrastanforderungen als Kommentar neben der Farbe." Ein
// Kommentar ist aber nur eine Behauptung. Dieses Skript macht daraus eine
// Zusage, die kaputtgehen kann.
//
// Die Stildatei erklärt ihre eigenen Ansprüche in Anweisungen der Form
//
//     /* @kontrast --ton-text auf --ton-grund mindestens 4.5 */
//
// Dieses Skript liest die Token-Werte, rechnet das Kontrastverhältnis nach
// WCAG 2.1 nach und ist rot, wenn eine Anweisung nicht hält. Findet es keine
// Anweisung, ist das ein Fehler, kein Erfolg (docs/ARBEITSWEISE.md, Falle 2).
//
// Aufruf: node scripts/kontrast-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILDATEI = join(wurzel, 'oberflaeche', 'src', 'styles.css');

// WCAG 2.1: Schwellen für Text. 4.5 für normalen Text (AA), 3 für großen
// Text und für die Abgrenzung von Bedienelementen (AA), 7 für AAA.
const SCHWELLE_KLEIN = 0.03928;
const TEILER_KLEIN = 12.92;
const VERSATZ = 0.055;
const TEILER_GROSS = 1.055;
const EXPONENT = 2.4;
const ANTEIL_ROT = 0.2126;
const ANTEIL_GRUEN = 0.7152;
const ANTEIL_BLAU = 0.0722;
const HELLIGKEITSVERSATZ = 0.05;
const NACHKOMMASTELLEN = 2;

// Kein Zeilenanfang verlangt: Ein Token darf auch hinter `:root {` auf
// derselben Zeile stehen. Die erste Fassung prüfte `^\s*` und fand in einer
// einzeiligen Datei gar nichts — gefunden von der Testsuite dieses Gates.
const TOKEN = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
const ANWEISUNG = /@kontrast\s+(--[a-z0-9-]+)\s+auf\s+(--[a-z0-9-]+)\s+mindestens\s+([\d.]+)/g;

/** #rgb, #rrggbb oder #rrggbbaa zu [r, g, b]; Alpha wird ignoriert und gemeldet. */
export function kanaele(hex) {
  let ziffern = hex.slice(1);
  if (ziffern.length === 3) ziffern = [...ziffern].map((z) => z + z).join('');
  if (ziffern.length === 8) ziffern = ziffern.slice(0, 6);
  if (ziffern.length !== 6) throw new Error(`Farbe nicht lesbar: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(ziffern.slice(i, i + 2), 16));
}

/** Relative Helligkeit nach WCAG 2.1. */
export function helligkeit(hex) {
  const linear = kanaele(hex)
    .map((wert) => wert / 255)
    .map((wert) => (wert <= SCHWELLE_KLEIN ? wert / TEILER_KLEIN : ((wert + VERSATZ) / TEILER_GROSS) ** EXPONENT));
  return ANTEIL_ROT * linear[0] + ANTEIL_GRUEN * linear[1] + ANTEIL_BLAU * linear[2];
}

/** Kontrastverhältnis zweier Farben, immer >= 1. */
export function verhaeltnis(vordergrund, hintergrund) {
  const a = helligkeit(vordergrund);
  const b = helligkeit(hintergrund);
  const hell = Math.max(a, b);
  const dunkel = Math.min(a, b);
  return (hell + HELLIGKEITSVERSATZ) / (dunkel + HELLIGKEITSVERSATZ);
}

export function lieseTokens(css) {
  const tokens = new Map();
  for (const treffer of css.matchAll(TOKEN)) tokens.set(treffer[1], treffer[2]);
  return tokens;
}

export function lieseAnweisungen(css) {
  return [...css.matchAll(ANWEISUNG)].map((t) => ({ vordergrund: t[1], hintergrund: t[2], mindestens: Number(t[3]) }));
}

/** Prüft eine Stildatei; liefert Zeilen und die Zahl der Verstöße. */
export function pruefe(css) {
  const tokens = lieseTokens(css);
  const anweisungen = lieseAnweisungen(css);
  const zeilen = [];
  let fehler = 0;

  if (anweisungen.length === 0) {
    return { zeilen: ['  FEHLER keine @kontrast-Anweisung gefunden — ohne Grundlage kein Erfolg'], fehler: 1, geprueft: 0 };
  }

  for (const { vordergrund, hintergrund, mindestens } of anweisungen) {
    const vorne = tokens.get(vordergrund);
    const hinten = tokens.get(hintergrund);
    if (!vorne || !hinten) {
      const unbekannt = [!vorne && vordergrund, !hinten && hintergrund].filter(Boolean);
      zeilen.push(`  FEHLER ${vordergrund} auf ${hintergrund}: ${unbekannt.join(' und ')} ist kein Token in dieser Datei`);
      fehler += 1;
      continue;
    }
    const wert = verhaeltnis(vorne, hinten);
    const gerundet = Number(wert.toFixed(NACHKOMMASTELLEN));
    const beschreibung = `${vordergrund} (${vorne}) auf ${hintergrund} (${hinten}): ${gerundet}:1, verlangt ${mindestens}:1`;
    if (gerundet + Number.EPSILON < mindestens) {
      zeilen.push(`  ROT    ${beschreibung}`);
      fehler += 1;
    } else {
      zeilen.push(`  ok     ${beschreibung}`);
    }
  }
  return { zeilen, fehler, geprueft: anweisungen.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('');
  console.log('Kontrast-Check');
  console.log('==============');
  console.log(`Stildatei: ${relative(wurzel, STILDATEI)}`);
  console.log('');
  const { zeilen, fehler, geprueft } = pruefe(readFileSync(STILDATEI, 'utf8'));
  for (const zeile of zeilen) console.log(zeile);
  console.log('');
  if (fehler > 0) {
    console.log(`${fehler} von ${geprueft} Farbpaaren halten ihre Zusage nicht.`);
    process.exit(1);
  }
  console.log(`${geprueft} Farbpaare nachgerechnet, alle halten ihre Zusage.`);
}
