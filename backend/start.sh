#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

export NODE_ENV="${NODE_ENV:-production}"
export LEONBOS_DATA_DIR="${LEONBOS_DATA_DIR:-/var/lib/leonbos}"

node "$SCRIPT_DIR/server.js"
