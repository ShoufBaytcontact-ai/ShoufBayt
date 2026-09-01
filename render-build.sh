#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Building ShoufBayt website in $ROOT"
npm install
CI=false npm run build

if [ ! -f "$ROOT/build/index.html" ]; then
  echo "React build failed: build/index.html is missing"
  exit 1
fi

rm -rf "$ROOT/api/client-build"
cp -a "$ROOT/build" "$ROOT/api/client-build"
echo "Copied website to api/client-build"

cd "$ROOT/api"
npm install --include=dev
node node_modules/prisma/build/index.js generate
echo "API Prisma client generated"
