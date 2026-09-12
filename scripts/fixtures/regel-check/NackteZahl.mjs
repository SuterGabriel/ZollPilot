// Fixture: So sieht der Fehler aus, den das Gate fangen soll. Die Schwelle
// steht im Code statt in rules.yaml.
export function pruefeXXX99(akte) {
  const schwelle = 6000;
  const toleranz = 0.1;
  return akte.wert > schwelle + toleranz;
}
