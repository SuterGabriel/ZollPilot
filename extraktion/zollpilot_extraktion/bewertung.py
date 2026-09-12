"""Messung gegen das Golden Set: Field Exact Match je Belegtyp, Entscheidung je Akte.

Leitkennzahl ist nicht die Zeichengenauigkeit, sondern die aktenweite
korrekte Entscheidung (docs/07-idp-ocr.md, Kennzahlen). Deshalb zwei Zahlen:

  Field Exact Match   Anteil der erwarteten Assertions (aus testdaten/belege/
                      <akte>/erwartet.json), die mit gleichem Dokument, Pfad und
                      normalisiertem Wert extrahiert wurden. Je Belegtyp.
  Entscheidung        Liefert src/cli.mjs auf der extrahierten Akte die
                      Freigabe, die akte.json erwartet? Braucht Node.

Die Basislinie liegt im Repo (extraktion/basislinie.json). Ein Lauf ohne
Basislinie sagt das in der ersten Zeile und ist rot — nie stumm grün
(docs/ARBEITSWEISE.md, Falle 3). Ein Lauf unter der Basislinie ist rot.

    python -m zollpilot_extraktion.bewertung
    python -m zollpilot_extraktion.bewertung --basislinie-schreiben
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from .__main__ import lade_ordner
from .akte import extrahiere_akte
from .lesen import ocr_version

WURZEL = Path(__file__).resolve().parents[2]
BELEGE = WURZEL / "testdaten" / "belege"
BASISLINIE = WURZEL / "extraktion" / "basislinie.json"
CLI = WURZEL / "src" / "cli.mjs"

TOLERANZ_ZAHL = 1e-9


def werte_gleich(erwartet: Any, tatsaechlich: Any) -> bool:
    if isinstance(erwartet, bool) or isinstance(tatsaechlich, bool):
        return erwartet == tatsaechlich
    if isinstance(erwartet, (int, float)) and isinstance(tatsaechlich, (int, float)):
        return abs(erwartet - tatsaechlich) <= TOLERANZ_ZAHL
    return erwartet == tatsaechlich


def vergleiche(erwartet: list[dict], akte: dict) -> dict[str, dict[str, Any]]:
    """Je Belegtyp: erwartet, exakt, fehlend, abweichend, überzählig."""
    typ_von = {d["id"]: d["typ"] for d in akte["dokumente"]}
    extrahiert = {(a["dokument"], a["pfad"]): a for a in akte["assertions"]}
    typ_erwartet = {(e["dokument"], e["pfad"]): e.get("typ") for e in erwartet}
    ergebnis: dict[str, dict[str, Any]] = {}

    def eintrag(typ: str) -> dict[str, Any]:
        return ergebnis.setdefault(typ, {"erwartet": 0, "exakt": 0, "fehlend": [], "abweichend": [], "ueberzaehlig": []})

    for e in erwartet:
        typ = e.get("typ") or typ_von.get(e["dokument"], "?")
        z = eintrag(typ)
        z["erwartet"] += 1
        a = extrahiert.get((e["dokument"], e["pfad"]))
        if e["wert"] is None:
            # Erwartet "nicht behauptet": Der Beleg sagt dazu nichts. Erfüllt,
            # wenn keine Assertion oder eine mit Wert None vorliegt.
            if a is None or a["wert"] is None:
                z["exakt"] += 1
            else:
                z["abweichend"].append(f"{e['dokument']} {e['pfad']}: erwartet nichts, extrahiert {a['wert']!r}")
            continue
        if a is None:
            z["fehlend"].append(f"{e['dokument']} {e['pfad']}: erwartet {e['wert']!r}")
        elif werte_gleich(e["wert"], a["wert"]):
            z["exakt"] += 1
        else:
            z["abweichend"].append(f"{e['dokument']} {e['pfad']}: erwartet {e['wert']!r}, extrahiert {a['wert']!r} (roh {a.get('roh')!r}, Konfidenz {a.get('konfidenz')})")

    for (dokument, pfad), a in extrahiert.items():
        if (dokument, pfad) not in typ_erwartet:
            eintrag(typ_von.get(dokument, "?"))["ueberzaehlig"].append(f"{dokument} {pfad} = {a['wert']!r}")
    return ergebnis


def entscheidung(akte: dict) -> dict[str, Any] | None:
    node = shutil.which("node")
    if not node or not CLI.exists():
        return None
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(akte, f, ensure_ascii=False)
        pfad = f.name
    try:
        lauf = subprocess.run([node, str(CLI), pfad, "--json"], capture_output=True, text=True, encoding="utf-8", cwd=WURZEL)
    finally:
        Path(pfad).unlink(missing_ok=True)
    if lauf.returncode not in (0, 1) or not lauf.stdout.strip():
        raise RuntimeError(f"src/cli.mjs: Exit {lauf.returncode}\n{lauf.stderr}")
    ergebnis = json.loads(lauf.stdout)
    return {
        "freigabe": ergebnis["freigabe"],
        "regeln": sorted(b["regel"] for b in ergebnis["befunde"] if b["status"] != "ok"),
        "pflicht": sorted(b["id"] for b in ergebnis["pflichtmatrix"]["befunde"] if b["status"] != "ok"),
    }


def bewerte(ocr: bool = True) -> dict[str, Any]:
    ordner = sorted(p for p in BELEGE.iterdir() if p.is_dir()) if BELEGE.exists() else []
    if not ordner:
        raise SystemExit(f"KEINE BELEGE unter {BELEGE}: erst testdaten/erzeuge-belege.py ausführen")

    summen: dict[str, dict[str, int]] = {}
    akten: list[dict[str, Any]] = []
    for pfad in ordner:
        stammdaten, dateien = lade_ordner(pfad)
        erwartet = json.loads((pfad / "erwartet.json").read_text(encoding="utf-8"))
        akte = extrahiere_akte(stammdaten, dateien, ocr=ocr)
        felder = vergleiche(erwartet, akte)
        for typ, z in felder.items():
            s = summen.setdefault(typ, {"erwartet": 0, "exakt": 0})
            s["erwartet"] += z["erwartet"]
            s["exakt"] += z["exakt"]
        ent = entscheidung(akte)
        erwartung = stammdaten.get("erwartung", {})
        korrekt = None
        if ent is not None:
            korrekt = ent["freigabe"] == erwartung.get("freigabe") and ent["regeln"] == sorted(erwartung.get("regeln", [])) and ent["pflicht"] == sorted(erwartung.get("pflicht", []))
        akten.append({"name": pfad.name, "felder": felder, "entscheidung": ent, "erwartung": erwartung, "korrekt": korrekt, "hinweise": akte["extraktion"]["hinweise"]})

    quoten = {typ: (s["exakt"] / s["erwartet"] if s["erwartet"] else 1.0) for typ, s in summen.items()}
    gesamt_erwartet = sum(s["erwartet"] for s in summen.values())
    gesamt_exakt = sum(s["exakt"] for s in summen.values())
    quoten["gesamt"] = gesamt_exakt / gesamt_erwartet if gesamt_erwartet else 1.0
    mit_entscheidung = [a for a in akten if a["korrekt"] is not None]
    return {
        "field_exact_match": {k: round(v, 4) for k, v in sorted(quoten.items())},
        "akten": len(akten),
        "entscheidungen_geprueft": len(mit_entscheidung),
        "entscheidungen_korrekt": sum(1 for a in mit_entscheidung if a["korrekt"]),
        "details": akten,
        "summen": summen,
    }


def drucke(bericht: dict[str, Any]) -> None:
    print()
    print("Bewertung der Extraktion gegen das Golden Set")
    print("=============================================")
    print()
    for typ, s in sorted(bericht["summen"].items()):
        print(f"  {typ:<22} {s['exakt']:>4} / {s['erwartet']:<4} exakt   ({bericht['field_exact_match'][typ] * 100:5.1f} %)")
    print(f"  {'gesamt':<22} {sum(s['exakt'] for s in bericht['summen'].values()):>4} / {sum(s['erwartet'] for s in bericht['summen'].values()):<4} exakt   ({bericht['field_exact_match']['gesamt'] * 100:5.1f} %)")
    print()
    for a in bericht["details"]:
        marke = "ok " if a["korrekt"] else ("ROT" if a["korrekt"] is False else "-- ")
        ent = a["entscheidung"]
        if ent is None:
            print(f"  {marke}   {a['name']:<28} (Node fehlt, Entscheidung nicht geprüft)")
        else:
            print(f"  {marke}   {a['name']:<28} {ent['freigabe']:<28} erwartet {a['erwartung'].get('freigabe')}")
            if not a["korrekt"]:
                print(f"          Regeln {ent['regeln']} erwartet {sorted(a['erwartung'].get('regeln', []))}; Pflicht {ent['pflicht']} erwartet {sorted(a['erwartung'].get('pflicht', []))}")
        for typ, z in a["felder"].items():
            for text in z["fehlend"]:
                print(f"          FEHLT      {text}")
            for text in z["abweichend"]:
                print(f"          ABWEICHEND {text}")
            for text in z["ueberzaehlig"]:
                print(f"          ZUSÄTZLICH {text}")
        for h in a["hinweise"]:
            print(f"          HINWEIS    {h}")
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--basislinie-schreiben", action="store_true", help="aktuellen Stand als Basislinie speichern")
    parser.add_argument("--ohne-ocr", action="store_true")
    parser.add_argument("--json", action="store_true", help="Bericht als JSON")
    args = parser.parse_args(argv)

    if not args.ohne_ocr and ocr_version() is None:
        print("KEIN OCR: Tesseract fehlt. Die Bewertung braucht es für den schlechten Scan.")
        print("Entweder --ohne-ocr (nur die digitalen Belege, kein Vergleich mit der Basislinie)")
        print("oder das Test-Image aus extraktion/Dockerfile (docs/EXTRAKTION.md).")
        return 1

    bericht = bewerte(ocr=not args.ohne_ocr)
    if args.json:
        print(json.dumps({k: v for k, v in bericht.items() if k != "details"}, indent=2, ensure_ascii=False))
    else:
        drucke(bericht)

    stand = {
        "field_exact_match": bericht["field_exact_match"],
        "akten": bericht["akten"],
        "entscheidungen_geprueft": bericht["entscheidungen_geprueft"],
        "entscheidungen_korrekt": bericht["entscheidungen_korrekt"],
    }
    if args.basislinie_schreiben:
        BASISLINIE.write_text(json.dumps(stand, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Basislinie geschrieben: {BASISLINIE.relative_to(WURZEL)}")
        return 0

    if args.ohne_ocr:
        # Ohne OCR fehlt der Scan; ein Vergleich mit der Basislinie wäre
        # immer rot und sagte nichts. Der Bericht oben ist die Aussage.
        print("OHNE OCR: nur die digitalen Belege gemessen, kein Vergleich mit der Basislinie.")
        return 0

    if not BASISLINIE.exists():
        print("KEINE BASISLINIE: extraktion/basislinie.json fehlt. Mit --basislinie-schreiben anlegen — bewusst, nicht nebenbei.")
        return 1

    basis = json.loads(BASISLINIE.read_text(encoding="utf-8"))
    rot: list[str] = []
    for typ, quote in basis["field_exact_match"].items():
        aktuell = stand["field_exact_match"].get(typ)
        if aktuell is None:
            rot.append(f"{typ}: in der Basislinie, aber nicht mehr gemessen")
        elif aktuell + TOLERANZ_ZAHL < quote:
            rot.append(f"{typ}: {aktuell * 100:.1f} % unter Basislinie {quote * 100:.1f} %")
    if stand["entscheidungen_geprueft"] and stand["entscheidungen_korrekt"] < basis.get("entscheidungen_korrekt", 0):
        rot.append(f"Entscheidungen: {stand['entscheidungen_korrekt']} korrekt, Basislinie {basis['entscheidungen_korrekt']}")
    if rot:
        print("Unter der Basislinie:")
        for text in rot:
            print(f"  ROT {text}")
        return 1
    print(f"Basislinie gehalten: Field Exact Match gesamt {stand['field_exact_match']['gesamt'] * 100:.1f} %, Entscheidungen {stand['entscheidungen_korrekt']}/{stand['entscheidungen_geprueft']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
