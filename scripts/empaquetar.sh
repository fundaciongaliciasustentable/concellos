#!/usr/bin/env bash
# Rexenera as páxinas e deixa en dist/ (e en concellos-web.zip) só os ficheiros públicos.
# Sube o contido de dist/ á raíz do subdominio concellos.galiciasustentable.org.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/xerar_paxinas.py

rm -rf dist concellos-web.zip
mkdir -p dist
cp -R index.html es assets js datos dist/

# Auditoría: nada se carga doutra orixe (as ligazóns <a href> si poden ir fóra).
if grep -rnE '(src|srcset)="https?://|url\((["'"'"']?)https?://|import[^;]*["'"'"']https?://|fetch\(["'"'"'`]https?://|<link[^>]+rel="stylesheet"[^>]+href="https?://' dist; then
  echo "Erro: hai recursos doutra orixe en dist/" >&2
  exit 1
fi

(cd dist && zip -qr ../concellos-web.zip .)
echo "dist/ e concellos-web.zip listos ($(du -sh dist | cut -f1))"
