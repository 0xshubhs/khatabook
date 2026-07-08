#!/usr/bin/env bash
# ============================================================================
# khatabook-webapp — Next.js frontend (bun) on port 3000.
# Public URL: nginx routes propexty.com/ -> 127.0.0.1:3000
#
# The API base is baked into the CLIENT bundle at BUILD time via
# NEXT_PUBLIC_API_URL (=$API_PUBLIC_URL below). Same-origin with the API
# (propexty.com + propexty.com/api) → no CORS. The backend runs separately
# on :4000 behind nginx /api/ — see scripts/backend.sh.
#
# Commands:  start | stop | restart | status | logs | build
#   start   → build if needed, then serve
#   build   → clean `next build` with the prod API URL baked in
#   restart → stop, rebuild, start (use this to deploy new code)
# ============================================================================

set -eo pipefail

REPO_NAME="khatabook-webapp"
PORT=3000
API_PUBLIC_URL="https://propexty.com/api"     # baked into the client bundle at build time

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/webapp"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"
WEB_PID="$PID_DIR/web.pid"
WEB_LOG="$LOG_DIR/web.log"
mkdir -p "$PID_DIR" "$LOG_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}[OK]${NC}    $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERR]${NC}   $1"; }
info() { echo -e "${CYAN}[INFO]${NC}  $1"; }
step() { echo -e "\n${BOLD}=== $1 ===${NC}"; }
die()  { err "$1"; exit 1; }

preflight() {
    step "Preflight ($REPO_NAME)"
    local ok=true
    command -v bun &>/dev/null  || { err "Bun not found";  ok=false; }
    command -v curl &>/dev/null || { err "curl not found"; ok=false; }
    [ "$ok" = false ] && die "Fix the above and re-run."
    log "Bun $(bun --version)"
}

install_deps() {
    # bun HOISTS deps to the ROOT node_modules, so apps/webapp usually has no
    # node_modules of its own — check for `next` in root OR webapp, not the dir.
    if [ ! -d "$ROOT_DIR/node_modules/next" ] && [ ! -d "$WEB_DIR/node_modules/next" ]; then
        step "Install dependencies"
        info "bun install (workspace)…"
        cd "$ROOT_DIR" && bun install 2>&1
        { [ -d "$ROOT_DIR/node_modules/next" ] || [ -d "$WEB_DIR/node_modules/next" ]; } \
            || die "'next' not installed — root package.json \"workspaces\" must include \"apps/webapp\". Fix it, run 'bun install', then retry."
    fi
}

build_web() {
    step "Build webapp (API → $API_PUBLIC_URL)"
    install_deps
    cd "$WEB_DIR"
    # NEXT_PUBLIC_* are compiled into the client bundle, so the API base must be
    # set at BUILD time — not runtime. .env.production.local wins for prod builds.
    info "Writing .env.production.local"
    cat > .env.production.local <<PROD
NEXT_PUBLIC_API_URL=$API_PUBLIC_URL
PROD
    # Clean rebuild so a stale/partial .next can't leave orphaned chunks behind.
    info "Removing previous .next (clean rebuild)"
    rm -rf "$WEB_DIR/.next"
    info "next build… (this is the slow step)"
    NODE_ENV=production bun run build 2>&1
    log "Built → .next/"
}

kill_service() {
    local name="$1" pid_file="$2" port="$3"
    if [ -f "$pid_file" ]; then
        local pid; pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            local w=0
            while kill -0 "$pid" 2>/dev/null && [ $w -lt 5 ]; do sleep 1; w=$((w+1)); done
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
            log "$name stopped (PID $pid)"
        fi
        rm -f "$pid_file"
    fi
    # `next start` spawns a next-server child that can outlive the parent PID and
    # keep the port (EADDRINUSE on restart). fuser -k kills every holder.
    if [ -n "$port" ]; then
        fuser -k "$port/tcp" 2>/dev/null || true
        local pids; pids=$(lsof -ti :"$port" 2>/dev/null || true)
        [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
        local w=0
        while { fuser -s "$port/tcp" 2>/dev/null || lsof -ti :"$port" >/dev/null 2>&1; } && [ $w -lt 8 ]; do sleep 1; w=$((w+1)); done
        info "Freed :$port"
    fi
    return 0
}

start_web() {
    step "Start webapp (port $PORT)"
    kill_service "webapp" "$WEB_PID" "$PORT"
    [ -d "$WEB_DIR/.next" ] || { warn "No .next/ — building first"; build_web; }
    cd "$WEB_DIR"
    # `bun run start` == `next start -p 3000` (see apps/webapp/package.json).
    # bun shims `node`, so this runs even on a node-less (bun-only) server.
    nohup env NODE_ENV=production bun run start >> "$WEB_LOG" 2>&1 &
    local pid=$!; echo "$pid" > "$WEB_PID"; disown 2>/dev/null || true
    info "Starting Next.js (PID $pid) — logging to $WEB_LOG"
    local r=0
    while ! curl -s -o /dev/null "http://localhost:$PORT/"; do
        if ! kill -0 "$pid" 2>/dev/null; then err "Webapp crashed on startup:"; tail -30 "$WEB_LOG"; die "Webapp failed"; fi
        r=$((r+1)); [ $r -ge 40 ] && { tail -30 "$WEB_LOG"; die "Webapp not responding on :$PORT"; }
        sleep 1
    done
    log "Webapp running → http://localhost:$PORT (PID $pid)"
}

stop_all() {
    step "Stopping $REPO_NAME"
    kill_service "webapp" "$WEB_PID" "$PORT"
    log "$REPO_NAME stopped"
}

show_status() {
    step "Status ($REPO_NAME)"
    if [ -f "$WEB_PID" ] && kill -0 "$(cat "$WEB_PID")" 2>/dev/null; then
        log "Webapp: RUNNING (PID $(cat "$WEB_PID"), port $PORT)"
    elif lsof -ti :"$PORT" &>/dev/null; then
        log "Webapp: RUNNING (port $PORT, no pid file)"
    else
        err "Webapp: STOPPED"
    fi
    echo -e "  public: ${BOLD}https://propexty.com${NC}  (nginx → :$PORT)   |   API baked: $API_PUBLIC_URL"
}

tail_logs() {
    step "Tailing $WEB_LOG (Ctrl+C to stop)"
    tail -f "$WEB_LOG" 2>/dev/null || warn "No log file yet — start the webapp first."
}

main() {
    local cmd="${1:-start}"
    echo -e "${BOLD}${CYAN}$REPO_NAME${NC} ${YELLOW}(:$PORT)${NC}\n"
    case "$cmd" in
        start)   preflight; start_web; log "Up → http://localhost:$PORT   (public: https://propexty.com)" ;;
        stop)    stop_all ;;
        restart) stop_all; sleep 1; preflight; build_web; start_web ;;
        status)  show_status ;;
        logs)    tail_logs ;;
        build)   preflight; build_web; log "Build done" ;;
        *)
            echo "Usage: $0 <command>"
            echo "  start | stop | restart | status | logs | build"
            exit 1
            ;;
    esac
}

main "$@"
