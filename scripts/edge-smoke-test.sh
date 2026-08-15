#!/usr/bin/env bash
# External deployment smoke test: verifies the *public edge* actually serves
# the required security headers and endpoints. Helmet configuration inside the
# app is not sufficient evidence — a proxy/CDN can strip or override headers.
# Usage: ./scripts/edge-smoke-test.sh https://your-production-origin
set -euo pipefail

ORIGIN="${1:?Usage: edge-smoke-test.sh <https-origin>}"
FAIL=0

check_header() {
  local path="$1" header="$2" expect="$3"
  local value
  value="$(curl -fsS -o /dev/null -D - "$ORIGIN$path" | tr -d '\r' | grep -i "^$header:" | head -1 | cut -d' ' -f2- || true)"
  if [[ -z "$value" ]]; then
    echo "FAIL  $path missing header $header"; FAIL=1
  elif [[ -n "$expect" && "$value" != *"$expect"* ]]; then
    echo "FAIL  $path $header='$value' (expected to contain '$expect')"; FAIL=1
  else
    echo "ok    $path $header: $value"
  fi
}

echo "== HTML document headers =="
check_header "/" "content-security-policy" "default-src 'self'"
check_header "/" "x-content-type-options" "nosniff"
check_header "/" "x-frame-options" ""
check_header "/" "referrer-policy" "no-referrer"
check_header "/" "permissions-policy" "geolocation=(self)"

echo "== API =="
check_header "/api/healthz" "cache-control" "no-store"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN/api/healthz")"
[[ "$STATUS" == "200" ]] && echo "ok    /api/healthz 200" || { echo "FAIL  /api/healthz -> $STATUS"; FAIL=1; }
READY="$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN/api/readyz")"
[[ "$READY" == "200" ]] && echo "ok    /api/readyz 200" || { echo "FAIL  /api/readyz -> $READY"; FAIL=1; }

echo "== CSRF / origin control =="
CSRF="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ORIGIN/api/auth/login" \
  -H 'Content-Type: application/json' -H 'Origin: https://evil.example' -d '{}')"
[[ "$CSRF" == "403" ]] && echo "ok    cross-origin POST rejected (403)" || { echo "FAIL  cross-origin POST -> $CSRF (expected 403)"; FAIL=1; }

if [[ "$FAIL" == "1" ]]; then
  echo "EDGE SMOKE TEST FAILED" >&2
  exit 1
fi
echo "EDGE SMOKE TEST PASSED"
