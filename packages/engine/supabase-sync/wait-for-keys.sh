#!/bin/sh
# Polls <repo>/.env every 2 minutes for the variable NAMES only (never values). Prints present/absent.
ENVF="$(cd "$(dirname "$0")/.." && pwd)/.env"
while :; do
  u=absent; k=absent
  [ -f "$ENVF" ] && grep -q '^[[:space:]]*\(export \)\{0,1\}SUPABASE_URL=..' "$ENVF" && u=present
  [ -f "$ENVF" ] && grep -q '^[[:space:]]*\(export \)\{0,1\}SUPABASE_SERVICE_ROLE_KEY=..' "$ENVF" && k=present
  echo "$(date +%H:%M:%S) SUPABASE_URL $u | SUPABASE_SERVICE_ROLE_KEY $k"
  [ "$u" = present ] && [ "$k" = present ] && exit 0
  sleep 120
done
