#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  if [[ -x "$BUNDLED_NODE" ]]; then
    NODE_BIN="$BUNDLED_NODE"
  fi
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 Node.js。请先安装 Node.js 20 或更高版本。" >&2
  exit 1
fi

VITE_ENTRY="$PROJECT_DIR/node_modules/vite/bin/vite.js"
if [[ ! -f "$VITE_ENTRY" ]]; then
  echo "缺少 node_modules。请先在项目目录执行 pnpm install。" >&2
  exit 1
fi

exec "$NODE_BIN" "$VITE_ENTRY" --host 0.0.0.0 --port 5178 --strictPort
