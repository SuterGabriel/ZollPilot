// Fixture: 0, 1 und 2 sind erlaubt, weil sie in jedem Code vorkommen. Das ist
// die bewusste Lücke aus ADR-002: eine fachliche Zwei rutscht durch.
export function pruefeXXX97(positionen) {
  if (positionen.length === 0) return null;
  return positionen.map((p, i) => ({ nr: i + 1, doppelt: p.menge * 2 }));
}
