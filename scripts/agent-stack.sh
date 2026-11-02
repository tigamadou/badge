#!/usr/bin/env bash
#
# agent-stack.sh — Stack legere d'un sous-agent : worktree + app, worker et Mailpit
# propres, MySQL / RustFS / renderer partages avec la stack principale (qui doit
# tourner). Voir docs/v4/installation.md, section « Stacks d'agents ».
#
#   scripts/agent-stack.sh up <lot> <branche-base>   # ex. up 2a feat/commandes-impression
#   scripts/agent-stack.sh down <lot>                # arrete la stack (worktree, branche, bases gardes)
#   scripts/agent-stack.sh status
#
# Le lot donne : worktree ../badge-wt-<lot>, branche feat/commandes-impression-<lot>,
# projet Compose badge-ag-<lot>, bases badge_<lot> et badge_<lot>_test, buckets
# badge-<lot> et badge-<lot>-test, port de l'app 3790-3799 (127.0.0.1 seulement).

set -euo pipefail

MAX_STACKS=3
PORT_MIN=3790
PORT_MAX=3799
REPO="$(git rev-parse --show-toplevel)"
MAIN_COMPOSE=(docker compose -f "$REPO/docker-compose.dev.yml")

die() { echo "✗ $*" >&2; exit 1; }

agent_projects() {
  docker compose ls --all --format '{{.Name}}' 2>/dev/null | grep -E '^badge-ag-' || true
}

check_lot() {
  [[ "${1:-}" =~ ^[a-z0-9]+$ ]] || die "lot invalide : « ${1:-} » (minuscules et chiffres seulement)"
}

worktree_of() { echo "$(dirname "$REPO")/badge-wt-$1"; }

agent_compose() {
  local lot="$1" port="$2"
  AGENT_LOT="$lot" AGENT_APP_PORT="$port" docker compose -p "badge-ag-$lot" \
    -f "$(worktree_of "$lot")/docker-compose.dev.yml" -f "$(worktree_of "$lot")/docker-compose.agent.yml" "${@:3}"
}

free_port() {
  local p
  for ((p = PORT_MIN; p <= PORT_MAX; p++)); do
    if ! lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then echo "$p"; return; fi
  done
  die "aucun port libre entre $PORT_MIN et $PORT_MAX"
}

cmd_up() {
  local lot="${1:-}" base="${2:-}"
  check_lot "$lot"
  [[ -n "$base" ]] || die "usage : up <lot> <branche-base>"
  local wt branch
  wt="$(worktree_of "$lot")"
  branch="feat/commandes-impression-$lot"

  # Prealables.
  local running
  running="$("${MAIN_COMPOSE[@]}" ps --status running --services 2>/dev/null)"
  for s in mysql rustfs renderer; do
    grep -qx "$s" <<<"$running" || die "stack principale : service « $s » arrete (lancer « make dev » dans $REPO)"
  done
  for img in badge-app:latest badge-worker:latest; do
    docker image inspect "$img" >/dev/null 2>&1 || die "image $img absente (lancer « make dev-build » dans $REPO)"
  done
  grep -qE '^NPM_TOKEN=.+' "$REPO/.env" 2>/dev/null || die "NPM_TOKEN absent de $REPO/.env"
  (( $(agent_projects | wc -l) < MAX_STACKS )) || die "déjà $MAX_STACKS stacks d'agents (voir « status »)"
  [[ ! -e "$wt" ]] || die "le worktree $wt existe déjà"
  git -C "$REPO" rev-parse --verify --quiet "refs/heads/$base" >/dev/null || die "branche de base inconnue : $base"

  local port
  port="$(free_port)"

  git -C "$REPO" worktree add -b "$branch" "$wt" "$base"
  cp "$REPO/.env" "$wt/.env"
  cat >"$wt/.agent.env" <<EOF
# Stack d'agent « $lot » (scripts/agent-stack.sh) — ne pas versionner.
AGENT_LOT = $lot
AGENT_APP_PORT = $port
export AGENT_LOT AGENT_APP_PORT
DB_HOST = host.docker.internal:33060
DB_NAME = badge_$lot
S3_TEST_BUCKET = badge-$lot-test
DEV_COMPOSE = docker compose -p badge-ag-$lot -f docker-compose.dev.yml -f docker-compose.agent.yml
EOF

  echo "▶ Démarrage de la stack badge-ag-$lot (port $port)…"
  make -C "$wt" dev
  local i
  for ((i = 0; i < 90; i++)); do
    curl -fsS -o /dev/null "http://127.0.0.1:$port/login" && break
    sleep 5
  done
  curl -fsS -o /dev/null "http://127.0.0.1:$port/login" || die "l'app de l'agent ne répond pas sur le port $port (voir « make -C $wt logs »)"

  make -C "$wt" db-push db-seed test-db

  echo "✓ Stack prête"
  echo "  worktree : $wt  (branche $branch)"
  echo "  app      : http://localhost:$port"
  echo "  bases    : badge_$lot, badge_${lot}_test   buckets : badge-$lot, badge-$lot-test"
}

cmd_down() {
  local lot="${1:-}"
  check_lot "$lot"
  local wt port
  wt="$(worktree_of "$lot")"
  [[ -f "$wt/.agent.env" ]] || die "pas de stack d'agent dans $wt"
  port="$(awk -F' = ' '/^AGENT_APP_PORT/{print $2}' "$wt/.agent.env")"
  agent_compose "$lot" "$port" down -v
  echo "✓ Stack badge-ag-$lot arrêtée (conteneurs et volumes de l'agent supprimés)."
  echo "  Conservés : worktree $wt, branche feat/commandes-impression-$lot, bases badge_$lot*, buckets badge-$lot*."
  echo "  Après fusion : git worktree remove $wt && git branch -d feat/commandes-impression-$lot"
  echo "                 make db-drop-agent LOT=$lot   (bases de l'agent)"
}

cmd_status() {
  local p lot wt port
  local projects
  projects="$(agent_projects)"
  [[ -n "$projects" ]] || { echo "Aucune stack d'agent."; return; }
  while IFS= read -r p; do
    lot="${p#badge-ag-}"
    wt="$(worktree_of "$lot")"
    port="$(awk -F' = ' '/^AGENT_APP_PORT/{print $2}' "$wt/.agent.env" 2>/dev/null || echo "?")"
    echo "$p  port $port  worktree $wt  bases badge_$lot, badge_${lot}_test"
  done <<<"$projects"
}

case "${1:-}" in
  up) cmd_up "${2:-}" "${3:-}" ;;
  down) cmd_down "${2:-}" ;;
  status) cmd_status ;;
  *) die "usage : $0 up <lot> <branche-base> | down <lot> | status" ;;
esac
