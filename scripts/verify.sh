#!/usr/bin/env bash
# Run every acceptance gate for a generated app and report a single verdict.
#
#   bash scripts/verify.sh [app-folder]
#
# Exit codes:
#   0  every gate passed
#   2  at least one gate failed  <- Claude Code treats exit 2 as blocking, which is why the
#                                   Stop hook in .claude/settings.json calls this script.
#   1  could not work out what to run (bad usage, no app found)
#
# Exit 1 deliberately does NOT block: "I could not find your app" is a setup problem, not a
# failed gate, and blocking on it would trap the agent in a loop it cannot escape.

set -uo pipefail

APP="${1:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ---------- locate the generated app ----------
if [[ -z "$APP" ]]; then
  if [[ -f package.json || -n "$(ls -1 ./*.sln 2>/dev/null)" ]]; then
    APP="."
  else
    mapfile -t CANDIDATES < <(find . -maxdepth 2 \( -name package.json -o -name '*.sln' \) \
      -not -path './node_modules/*' -not -path './.git/*' -printf '%h\n' 2>/dev/null | sort -u)
    if [[ ${#CANDIDATES[@]} -eq 1 ]]; then
      APP="${CANDIDATES[0]}"
    elif [[ ${#CANDIDATES[@]} -eq 0 ]]; then
      echo "verify: no app found. Generate one first, or pass the folder: bash scripts/verify.sh orders-grid" >&2
      exit 1
    else
      echo "verify: more than one app here — pass the folder explicitly:" >&2
      printf '  %s\n' "${CANDIDATES[@]}" >&2
      exit 1
    fi
  fi
fi

if [[ ! -d "$APP" ]]; then
  echo "verify: '$APP' is not a folder" >&2
  exit 1
fi
cd "$APP"
echo "verify: running gates in $(pwd)"
echo

FAILED=()
PASSED=()

run_gate () {           # run_gate <label> <command...>
  local label="$1"; shift
  printf '── %s\n' "$label"
  if "$@"; then
    PASSED+=("$label")
    printf '   PASS  %s\n\n' "$label"
  else
    FAILED+=("$label")
    printf '   FAIL  %s (exit %d)\n\n' "$label" "$?"
  fi
}

has_script () {         # is this npm script defined?
  node -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2>/dev/null
}

# ---------- Node app ----------
if [[ -f package.json ]]; then
  [[ -d node_modules ]] || run_gate "npm install" npm install --no-audit --no-fund

  for g in typecheck lint test check:clean build; do
    if has_script "$g"; then
      run_gate "npm run $g" npm run "$g" --silent
    else
      printf '── npm run %s\n   SKIP  not defined in package.json\n\n' "$g"
    fi
  done

  # The lint gate is only a gate with --max-warnings 0. A bare `eslint .` exits 0 on warnings,
  # so a script without the flag looks green while the code is full of them.
  if has_script lint && ! node -e "
      const s = require('./package.json').scripts.lint || '';
      process.exit(/--max-warnings[= ]0/.test(s) ? 0 : 1)"; then
    echo "verify: WARNING — the 'lint' script has no --max-warnings 0, so it exits 0 on warnings."
    echo "        That is not a gate. Fix package.json before trusting this run."
    echo
    FAILED+=("lint script is missing --max-warnings 0")
  fi
fi

# ---------- .NET app ----------
if compgen -G '*.sln' >/dev/null || compgen -G '*.csproj' >/dev/null; then
  run_gate "dotnet build -warnaserror" dotnet build -warnaserror --nologo -v minimal
  run_gate "dotnet test"               dotnet test --nologo -v minimal
fi

# ---------- verdict ----------
echo "════════════════════════════════════════"
for p in "${PASSED[@]:-}"; do [[ -n "$p" ]] && echo "  PASS  $p"; done
for f in "${FAILED[@]:-}"; do [[ -n "$f" ]] && echo "  FAIL  $f"; done
echo "════════════════════════════════════════"

if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo
  echo "NOT DONE. ${#FAILED[@]} gate(s) failed. Fix the code — never the gate."
  echo "Do not suppress a warning, weaken a test, or add 'as any' to get past this."
  exit 2
fi

echo
echo "All gates green. This is what 'finished' means."
exit 0
