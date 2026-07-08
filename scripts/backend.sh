#!/usr/bin/env bash
# ============================================================================
# khatabook-backend — Express API (bun, TypeScript) on port 3000.
# Public URL: nginx routes propexty.com/ -> 127.0.0.1:3000
#
# Commands:  start | stop | restart | status | logs | build | migrate | nuke
#
# Postgres/Redis/Kafka run in the SHARED `propexty-*` docker containers used by
# the other repos. This script does NOT own them — it only checks Postgres is
# up and that the app's database exists. `nuke` never touches those containers.
# ============================================================================

set -eo pipefail

REPO_NAME="khatabook-backend"
PORT=3000
PG_CONTAINER="propexty-postgres"          # the shared Postgres container name

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"
DB_DIR="$ROOT_DIR/packages/database"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"
API_PID="$PID_DIR/backend.pid"
API_LOG="$LOG_DIR/backend.log"
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
    command -v bun &>/dev/null    || { err "Bun not found";   ok=false; }
    command -v docker &>/dev/null || { err "Docker not found"; ok=false; }
    command -v curl &>/dev/null   || { err "curl not found";   ok=false; }
    [ "$ok" = false ] && die "Fix the above and re-run."
    log "Bun $(bun --version)  |  Docker $(docker --version | awk '{print $3}' | tr -d ',')"
}

validate_env() {
    step "Environment"
    [ ! -f "$BACKEND_DIR/.env" ] && die "Missing $BACKEND_DIR/.env"
    set -a && source "$BACKEND_DIR/.env" && set +a
    [ -z "$DATABASE_URL" ] && die "DATABASE_URL not set in .env"
    [ -z "$JWT_ACCESS_SECRET" ]  || [ ${#JWT_ACCESS_SECRET}  -lt 16 ] && die "JWT_ACCESS_SECRET missing/too short"
    [ -z "$JWT_REFRESH_SECRET" ] || [ ${#JWT_REFRESH_SECRET} -lt 16 ] && die "JWT_REFRESH_SECRET missing/too short"
    PORT="${PORT:-3000}"
    # Pull the db name out of the URL (…/<dbname>?…) so `nuke`/`ensure_infra` follow .env.
    DB_NAME="$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
    [ "${DEV_OTP:-}" = "123456" ] && warn "DEV_OTP=123456 → anyone can log in as any phone. DEV ONLY — do not ship to real users."
    log "Port: $PORT  |  DB: $DB_NAME"
}

ensure_infra() {
    step "Postgres ($PG_CONTAINER)"
    docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$" \
        || die "$PG_CONTAINER is not running — start the shared propexty stack first."
    local r=0
    while ! docker exec "$PG_CONTAINER" pg_isready -U postgres &>/dev/null; do
        r=$((r+1)); [ $r -ge 30 ] && die "Postgres not ready"; sleep 1
    done
    docker exec "$PG_CONTAINER" psql -U postgres -tc \
        "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
        || { info "Creating database '$DB_NAME'"; docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE $DB_NAME"; }
    log "Postgres ready, database '$DB_NAME' present"
}

install_deps() {
    if [ ! -d "$ROOT_DIR/node_modules" ] || [ ! -d "$BACKEND_DIR/node_modules" ]; then
        step "Install dependencies"
        info "bun install (workspace)…"
        cd "$ROOT_DIR" && bun install 2>&1
    fi
}

run_migrations() {
    step "Prisma (migrate deploy + generate)"
    cd "$DB_DIR"
    export DATABASE_URL                       # env wins over packages/database/.env
    bunx prisma migrate deploy 2>&1
    [ -d "$DB_DIR/generated" ] || bunx prisma generate 2>&1
    log "Database schema up to date"
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
    # Robustly free the port even if a child outlived the pid file.
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

start_backend() {
    step "Start backend (port $PORT)"
    kill_service "backend" "$API_PID" "$PORT"
    cd "$BACKEND_DIR"
    set -a && source "$BACKEND_DIR/.env" && set +a
    # nohup + disown → survives this SSH session closing (but NOT a reboot — see footer).
    nohup bun src/index.ts >> "$API_LOG" 2>&1 &
    local pid=$!; echo "$pid" > "$API_PID"; disown 2>/dev/null || true
    info "Starting backend (PID $pid) — logging to $API_LOG"
    local r=0
    while ! curl -s -o /dev/null "http://localhost:$PORT/health"; do
        if ! kill -0 "$pid" 2>/dev/null; then err "Backend crashed on startup:"; tail -25 "$API_LOG"; die "Backend failed"; fi
        r=$((r+1)); [ $r -ge 30 ] && { tail -25 "$API_LOG"; die "Backend not responding on :$PORT"; }
        sleep 1
    done
    log "Backend running → http://localhost:$PORT (PID $pid)"
}

stop_all() {
    step "Stopping $REPO_NAME"
    local p="$PORT"
    [ -f "$BACKEND_DIR/.env" ] && p="$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d= -f2 | tr -d '"' || echo "$PORT")"
    kill_service "backend" "$API_PID" "${p:-3000}"
    log "$REPO_NAME stopped (shared infra left running)"
}

show_status() {
    step "Status ($REPO_NAME)"
    if [ -f "$API_PID" ] && kill -0 "$(cat "$API_PID")" 2>/dev/null; then
        log "Backend: RUNNING (PID $(cat "$API_PID"), port $PORT)"
    elif lsof -ti :"$PORT" &>/dev/null; then
        log "Backend: RUNNING (port $PORT, no pid file)"
    else
        err "Backend: STOPPED"
    fi
    docker ps --filter "name=$PG_CONTAINER" --format "  {{.Names}}  {{.Status}}" 2>/dev/null || true
    echo -e "  public: ${BOLD}https://propexty.com${NC}  (nginx → :$PORT)"
}

tail_logs() {
    step "Tailing $API_LOG (Ctrl+C to stop)"
    tail -f "$API_LOG" 2>/dev/null || warn "No log file yet — start the backend first."
}

nuke_all() {
    echo -e "${RED}${BOLD}This stops the backend and DROPS the '$DB_NAME' database (all ledger data).${NC}"
    echo -e "${YELLOW}The shared postgres/redis/kafka containers are left untouched.${NC}"
    read -rp "Type 'yes' to confirm: " confirm
    [ "$confirm" != "yes" ] && { info "Cancelled."; return; }
    stop_all
    docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME" 2>&1 || true
    rm -rf "$PID_DIR" "$LOG_DIR"
    log "Backend stopped and database dropped. Run 'start' for a fresh setup."
}

do_start() {
    preflight; validate_env; ensure_infra; install_deps; run_migrations; start_backend
    log "Up → http://localhost:$PORT   (public: https://propexty.com)"
}

main() {
    local cmd="${1:-start}"
    echo -e "${BOLD}${CYAN}$REPO_NAME${NC} ${YELLOW}(:$PORT)${NC}\n"
    case "$cmd" in
        start)   do_start ;;
        stop)    stop_all ;;
        restart) stop_all; sleep 2; do_start ;;
        status)  show_status ;;
        logs)    tail_logs ;;
        build)   preflight; validate_env; install_deps; run_migrations; log "Build done" ;;
        migrate) preflight; validate_env; ensure_infra; run_migrations ;;
        nuke)    validate_env; nuke_all ;;
        *)
            echo "Usage: $0 <command>"
            echo "  start | stop | restart | status | logs | build | migrate | nuke"
            exit 1
            ;;
    esac
}

main "$@"
