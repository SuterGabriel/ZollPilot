# syntax=docker/dockerfile:1
# Die Oberfläche: bauen mit Node, ausliefern mit nginx.
#
# Zwei Stufen, keine Teststufe — anders als extraktion/Dockerfile. Dort
# braucht die Teststufe den Container, weil Tesseract auf einer
# Windows-Entwicklungsmaschine fehlt. Die Angular-Tests laufen überall mit
# `npm test`; ein Bau, der sie noch einmal ausführt, verlängert nur den Weg
# zum Bild. Geprüft wird im CI-Job `oberflaeche`.
#
# Build-Kontext ist die Repo-Wurzel, damit deploy/nginx/ mitkommt.

FROM node:24-alpine AS bau
WORKDIR /app
# Erst die Abhängigkeiten, dann die Quellen: Eine Änderung am Code macht die
# Installationsschicht nicht ungültig.
COPY oberflaeche/package.json oberflaeche/package-lock.json ./
RUN npm ci
COPY oberflaeche/ ./
RUN npm run build

FROM nginx:1.27-alpine AS final
COPY deploy/nginx/zollpilot.conf /etc/nginx/conf.d/default.conf
# Demo-Zugangsdaten (ADR-009). Im Zielsystem: die Datei aus einem
# Secret-Store einhängen statt ins Image kopieren (docs/BETRIEB.md).
COPY deploy/nginx/zollpilot.htpasswd /etc/nginx/zollpilot.htpasswd
COPY --from=bau /app/dist/zollpilot-oberflaeche/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=20 \
    CMD ["sh", "-c", "wget -qO- http://127.0.0.1:8080/healthz | grep -q ok"]
