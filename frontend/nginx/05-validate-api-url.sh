#!/bin/sh
# Runs before nginx renders its templates. API_URL is written into JavaScript and the CSP,
# so accept only a plain http(s) origin/path — no quotes, spaces or semicolons.
set -eu
: "${API_URL:=http://localhost:8080}"
if ! printf '%s' "$API_URL" | grep -Eq '^https?://[A-Za-z0-9._~:/[@!$&()*+,=%-]+$' || printf '%s' "$API_URL" | grep -q "[;'\"]"; then
  echo "API_URL must be a plain http(s) URL, got: $API_URL" >&2
  exit 1
fi
