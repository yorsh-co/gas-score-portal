#!/usr/bin/env bash
#
# Vendor the gas-webapp browser client (published on the `dist-web` branch,
# which `gasdev bundle` does not cover) into src/web/vendor/gas-webapp/.
#
# Usage:
#   scripts/sync-gas-webapp-client.sh
#
# Overrides:
#   GAS_WEBAPP_FRONTEND_REF=dist-web/v1.1.3
#   GAS_WEBAPP_REMOTE=https://github.com/yorsh-co/gas-webapp.git
#   GAS_WEBAPP_FRONTEND_PREFIX=src/web/vendor/gas-webapp

set -Eeuo pipefail

REF="${GAS_WEBAPP_FRONTEND_REF:-dist-web/v1.1.3}"
REMOTE="${GAS_WEBAPP_REMOTE:-https://github.com/yorsh-co/gas-webapp.git}"
PREFIX="${GAS_WEBAPP_FRONTEND_PREFIX:-src/web/vendor/gas-webapp}"

ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --quiet --depth 1 --branch "$REF" "$REMOTE" "$TMP/client"

rm -rf "${ROOT:?}/$PREFIX"
mkdir -p "$ROOT/$PREFIX"
tar -C "$TMP/client" --exclude=.git -cf - . | tar -C "$ROOT/$PREFIX" -xf -

echo "✓ vendored gas-webapp browser client @ $REF into $PREFIX"
