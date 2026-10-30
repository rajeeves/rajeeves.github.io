#!/usr/bin/env bash
# usage: ./build.sh [--offline]
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
if [[ "${1:-}" != "--offline" ]]; then
  python3 tools/inspire.py R.S.Erramilli.1 data
  python3 tools/software.py .
else
  python3 tools/software.py . --offline
fi
python3 tools/palettes.py build/palettes.css
python3 tools/fonts.py node_modules/@fontsource content build/fonts.css
python3 tools/bodyfonts.py node_modules/@fontsource build/bodyfonts.css
node tools/papers.js data/papers.json build/papers.html node_modules/katex content/selected build/selected.html
python3 tools/build.py .
