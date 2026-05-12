#!/usr/bin/env bash
# Baseline-generation orchestrator for visual regression suites.
#
# Single one-shot script that boots both servers (SSR for routes, static
# HTTP for Storybook), installs the Playwright browser if missing, runs
# the visual project with --update-snapshots, and tears everything down
# on exit (success OR failure).
#
# Usage:
#   tools/visual/baseline.sh             # update all baselines
#   tools/visual/baseline.sh routes      # only golden-paths.spec.ts
#   tools/visual/baseline.sh storybook   # only storybook.spec.ts
#
# Why a script and not bare npm chaining:
#   - Reproducible: same environment vars, same teardown order,
#     deterministic results across local and CI runs.
#   - Safe: traps SIGINT / EXIT so a Ctrl+C never leaves a server
#     orphaned on :4000 or :6006.
#   - Discoverable: contributor runs ONE command after intentional UI
#     changes, doesn't have to remember the 5-step sequence.
#
# This mirrors what bigtech VR systems (Chromatic, Argos, Percy) do
# server-side. We bundle the same orchestration into a local script so
# the team can self-host VR without a SaaS dependency.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$REPO_ROOT"

TARGET=${1:-all}
SSR_PORT=4000
SB_PORT=6006

declare -a CLEANUP_PIDS=()

cleanup() {
  local exit_code=$?
  for pid in "${CLEANUP_PIDS[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "  → stopping pid=$pid"
      kill "$pid" 2>/dev/null || true
      # Give it a beat then SIGKILL if it's still around.
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

log() { echo -e "\n\033[1;34m▶ $*\033[0m"; }

# ─── Playwright browser ──────────────────────────────────────────────
log "Ensuring Playwright chromium is installed"
if ! npx playwright install chromium --dry-run >/dev/null 2>&1; then
  npx playwright install --with-deps chromium
fi

# ─── SSR server (routes) ─────────────────────────────────────────────
if [[ "$TARGET" == "all" || "$TARGET" == "routes" ]]; then
  log "Building production bundle for SSR"
  npm run build

  log "Booting SSR server on :$SSR_PORT"
  PORT=$SSR_PORT node dist/prime-showcase/server/server.mjs > /tmp/ssr-baseline.log 2>&1 &
  CLEANUP_PIDS+=("$!")

  log "Waiting for SSR server to accept traffic"
  for i in {1..30}; do
    if curl -sf "http://127.0.0.1:$SSR_PORT/" -o /dev/null; then
      echo "  ✓ SSR ready after ${i}s"
      break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
      echo "  ✗ SSR did not come up in 30s"
      tail -20 /tmp/ssr-baseline.log
      exit 1
    fi
  done

  log "Generating route-level baselines"
  E2E_BASE_URL=http://127.0.0.1:$SSR_PORT npx playwright test --project=visual --update-snapshots=all tests/visual/golden-paths.spec.ts
fi

# ─── Storybook static server (component-level) ───────────────────────
if [[ "$TARGET" == "all" || "$TARGET" == "storybook" ]]; then
  log "Building Storybook"
  npm run build-storybook

  log "Booting Storybook static HTTP on :$SB_PORT"
  npx http-server dist/storybook -p $SB_PORT -c-1 --silent > /tmp/sb-baseline.log 2>&1 &
  CLEANUP_PIDS+=("$!")

  log "Waiting for Storybook server to accept traffic"
  for i in {1..30}; do
    if curl -sf "http://127.0.0.1:$SB_PORT/" -o /dev/null; then
      echo "  ✓ Storybook ready after ${i}s"
      break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
      echo "  ✗ Storybook did not come up in 30s"
      tail -20 /tmp/sb-baseline.log
      exit 1
    fi
  done

  log "Generating component-level baselines"
  STORYBOOK_BASE_URL=http://127.0.0.1:$SB_PORT npx playwright test --project=visual --update-snapshots=all tests/visual/storybook.spec.ts
fi

log "Done. Review the diff before committing."
echo "  git diff --stat tests/visual/__screenshots__"
echo "  git add tests/visual/__screenshots__/"
echo "  git commit -m 'chore(visual): refresh baselines'"
