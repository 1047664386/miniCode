#!/usr/bin/env bash
#
# MiniCodeIDE — 一键聚合启动脚本
#
# 用法:
#   pnpm dev              # 完整启动（infra + 全部服务）
#   pnpm dev --no-cloud   # 跳过 cloud server（不需要 PostgreSQL）
#   pnpm dev --quick      # 跳过 infra 检查，直接启动服务（适合 DB 已就绪）
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── 颜色 ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[dev]${NC} $*"; }
ok()    { echo -e "${GREEN}[dev]${NC} $*"; }
warn()  { echo -e "${YELLOW}[dev]${NC} $*"; }
err()   { echo -e "${RED}[dev]${NC} $*"; }

# ── 参数解析 ────────────────────────────────────────
SKIP_CLOUD=false
QUICK=false

for arg in "$@"; do
  case "$arg" in
    --no-cloud) SKIP_CLOUD=true ;;
    --quick)    QUICK=true ;;
    -h|--help)
      echo "用法: pnpm dev [选项]"
      echo ""
      echo "选项:"
      echo "  --no-cloud   跳过 cloud server（不需要 PostgreSQL）"
      echo "  --quick      跳过基础设施检查，直接启动服务"
      echo "  -h, --help   显示帮助"
      exit 0
      ;;
    *) warn "未知参数: $arg" ;;
  esac
done

# ── 子进程管理 ──────────────────────────────────────
PIDS=()
cleanup() {
  info "正在关闭所有服务..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  ok "已退出"
}
trap cleanup EXIT INT TERM

# ── 1. 基础设施：PostgreSQL ─────────────────────────
if [ "$SKIP_CLOUD" = false ] && [ "$QUICK" = false ]; then
  if ! command -v docker &>/dev/null; then
    warn "未找到 docker，跳过 cloud server（使用 --no-cloud 可跳过此检查）"
    SKIP_CLOUD=true
  else
    # 检查容器是否已在运行
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^mci-postgres$'; then
      ok "PostgreSQL 已在运行"
    else
      info "启动 PostgreSQL (docker compose)..."
      cd "$ROOT/infra"
      docker compose up -d postgres --quiet-pull 2>/dev/null || docker-compose up -d postgres 2>/dev/null || {
        warn "docker compose 启动失败，跳过 cloud server"
        SKIP_CLOUD=true
      }
      cd "$ROOT"
    fi

    if [ "$SKIP_CLOUD" = false ]; then
      # 等待 PostgreSQL 就绪
      info "等待 PostgreSQL 就绪..."
      for i in $(seq 1 30); do
        if docker exec mci-postgres pg_isready -U mci &>/dev/null; then
          ok "PostgreSQL 就绪"
          break
        fi
        if [ "$i" -eq 30 ]; then
          warn "PostgreSQL 30s 内未就绪，跳过 cloud server"
          SKIP_CLOUD=true
        fi
        sleep 1
      done
    fi

    # Prisma migrate + generate（幂等操作）
    if [ "$SKIP_CLOUD" = false ]; then
      info "检查数据库 migration..."
      pnpm --filter @mini/storage exec prisma migrate deploy --schema=prisma/schema.prisma 2>/dev/null \
        && ok "Migration 就绪" \
        || warn "Migration 跳过（可能已应用）"

      info "生成 Prisma Client..."
      pnpm --filter @mini/storage exec prisma generate --schema=prisma/schema.prisma 2>/dev/null \
        && ok "Prisma Client 已就绪" \
        || warn "Prisma Client 生成失败"
    fi
  fi
fi

# ── 2. 清理残留进程 ────────────────────────────────
info "清理残留端口进程..."
for port in 5173 5174 5175 4000; do
  pids=$(lsof -ti :$port 2>/dev/null) || true
  if [ -n "$pids" ]; then
    warn "  端口 $port 被占用 (PID: $pids)，正在清理..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 1  # 等待端口释放

# ── 3. 启动服务 ────────────────────────────────────

# 颜色标签用于各进程输出前缀
tag() {
  local label="$1" color="$2"
  while IFS= read -r line; do
    echo -e "${color}[${label}]${NC} ${line}"
  done
}

# desktop (Vite :5173) — 前端
info "启动 desktop (Vite :5173)..."
pnpm --filter @mini/desktop run dev 2>&1 | tag "desktop" "$CYAN" &
PIDS+=($!)

# server-node (:5175) — 主 API 服务
info "启动 server-node (:5175)..."
pnpm --filter @mini/server-node run dev 2>&1 | tag "server" "$GREEN" &
PIDS+=($!)

# server-cloud (:4000) — 云端服务（可选）
if [ "$SKIP_CLOUD" = false ]; then
  info "启动 server-cloud (:4000)..."
  pnpm --filter @mini/server-cloud run dev 2>&1 | tag "cloud" "$YELLOW" &
  PIDS+=($!)
else
  warn "跳过 server-cloud（使用 --no-cloud 或 docker 不可用）"
fi

echo ""
ok "════════════════════════════════════════════"
ok "  MiniCodeIDE 开发环境已启动"
ok "────────────────────────────────────────────"
ok "  前端:       http://localhost:5173"
ok "  API 服务:   http://localhost:5175"
if [ "$SKIP_CLOUD" = false ]; then
ok "  云端服务:   http://localhost:4000"
ok "  Adminer:    http://localhost:8080  (数据库管理)"
fi
ok "════════════════════════════════════════════"
echo ""
ok "按 Ctrl+C 停止所有服务"

# 等待所有子进程
wait
