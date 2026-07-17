#!/usr/bin/env bash
#
# run-plans.sh — Autonomous execution of implementation plans (project-agnostic).
#
# Re-launches Claude Code in a headless loop until ALL plan files found in
# EVERY folder named "plans" (whatever its parent: docs/v2/plans, docs/v4/plans,
# specs/plans, ...) are executed, task by task, following each plan's own steps
# and the repo's conventions (CLAUDE.md / AGENTS.md).
#
# ─────────────────────────────────────────────────────────────────────────────
# PROJECT-AGNOSTIC — nothing project-specific is hard-coded:
#   • Operates on the CURRENT directory ($PWD): copy this script anywhere
#     (e.g. ~/bin) or keep it in scripts/; run it from a repo root.
#   • Assumes no language, no test runner, no build command: the model runs the
#     "Verify" steps written INSIDE each plan.
#   • Does not assume plans self-delete. The completion signal is the number of
#     UNCHECKED task boxes ( "- [ ]" ) remaining across the plans. 0 remaining =>
#     done. Works whether the plan stays on disk (all boxes checked) OR is deleted
#     at the end ("ephemeral plans" policy).
# ─────────────────────────────────────────────────────────────────────────────
#
# COMPLETION = DETERMINISTIC signal based on filesystem state (remaining boxes),
# NOT on a keyword appearing in the log (false positives: the prompt/reasoning
# echoes those keywords and would break the loop on the very first turn).
#
# Survives session end and usage limits: it sleeps then re-launches
# (--continue preserves context, auto-compacted).
#
# Usage:
#   ./scripts/run-plans.sh
#   PLANS_DIRNAME=plans MODEL=claude-sonnet-5 MAX_ITER=500 ./scripts/run-plans.sh
#   WORKDIR=/path/to/another/repo ./scripts/run-plans.sh
#
# Stop: Ctrl-C; automatically when no box remains unchecked; or after STALL_LIMIT
# consecutive turns without progress (no additional box checked).

set -u

# --- Configuration (overridable via environment variables) -------------------
WORKDIR="${WORKDIR:-$PWD}"                        # target repo = current directory
PLANS_DIRNAME="${PLANS_DIRNAME:-plans}"  # name of the folders to scan (any parent)
MODEL="${MODEL:-claude-opus-4-8}"
MAX_ITER="${MAX_ITER:-300}"          # safety cap (number of re-launches)
MAX_TURNS="${MAX_TURNS:-200}"        # max turns per invocation
COOLDOWN="${COOLDOWN:-10}"           # normal pause between two re-launches (s)
LIMIT_SLEEP="${LIMIT_SLEEP:-1800}"   # pause when a usage limit is hit (s = 30 min)
STALL_LIMIT="${STALL_LIMIT:-4}"      # consecutive no-progress turns before giving up
LOGDIR="${LOGDIR:-$WORKDIR/.plan-logs}"
STREAM="${STREAM:-1}"                # 1 = watch everything live (tools, reasoning); 0 = final output only
PERMISSION_MODE="${PERMISSION_MODE:-bypassPermissions}"  # full autonomy; set to "default" to confirm

# Every folder named "$PLANS_DIRNAME" in the repo, whatever its parent
# (node_modules, .git and the log dir are excluded).
list_plans_dirs() {
  find "$WORKDIR" \
    \( -name node_modules -o -name .git -o -path "$LOGDIR" \) -prune \
    -o -type d -name "$PLANS_DIRNAME" -print 2>/dev/null | sort
}

# Plan files = *.md directly inside a plans folder (README excluded).
list_plan_files() {
  local d
  while IFS= read -r d; do
    find "$d" -maxdepth 1 -type f -name '*.md' ! -name 'README.md' 2>/dev/null
  done < <(list_plans_dirs)
}

# --- Prerequisites -----------------------------------------------------------
command -v claude >/dev/null 2>&1 || { echo "✗ 'claude' CLI not found in PATH."; exit 1; }
cd "$WORKDIR" || { echo "✗ Directory not found: $WORKDIR"; exit 1; }
if [[ -z "$(list_plans_dirs)" ]]; then
  echo "✗ No folder named '$PLANS_DIRNAME' found under: $WORKDIR"
  echo "  Set PLANS_DIRNAME (e.g. PLANS_DIRNAME=plans) or run from the repo root."
  exit 1
fi

# Pretty-print the stream-json flow (text, tool calls, results).
# The raw JSON is still saved to the log; here we only format the screen.
format_stream() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      if .type == "assistant" then
        ( .message.content[]? |
          if .type == "text" then .text
          elif .type == "tool_use" then "🔧 " + .name + "  " + ((.input | tostring)[0:160])
          else empty end )
      elif .type == "user" then
        ( .message.content[]? |
          if .type == "tool_result" then
            "← " + ( ( (.content // "") |
              if type == "array" then (map(.text? // "") | join(" ")) else tostring end )[0:200] )
          else empty end )
      elif .type == "result" then "──── end of turn ────"
      else empty end
    ' 2>/dev/null
  else
    cat   # jq missing: print raw JSON
  fi
}

# Count UNCHECKED task boxes ("- [ ]") across all plans of all plans folders.
# This is THE completion signal: 0 => done. Independent of whether plans get
# deleted (a deleted or fully-checked plan no longer counts).
count_pending_boxes() {
  local n=0 f
  while IFS= read -r f; do
    n=$((n + $(grep -cE '^[[:space:]]*- \[ \]' "$f" 2>/dev/null || true)))
  done < <(list_plan_files)
  echo "$n"
}

# Number of plans still pending (files with at least one unchecked box),
# for human-readable display only.
count_pending_plans() {
  local n=0 f
  while IFS= read -r f; do
    grep -qE '^[[:space:]]*- \[ \]' "$f" && n=$((n + 1))
  done < <(list_plan_files)
  echo "$n"
}

# Detect a REAL usage/rate limit. Anchor on the stream-json error envelope
# (final "is_error":true event) AND/OR API-specific technical strings absent from
# normal business content, NOT on free words (the log holds the whole flow: text,
# reasoning, file contents read). Avoid false positives when content mentions
# "rate limit", "429"...
hit_usage_limit() {
  tail -n 30 "$1" | grep -qiE 'rate_limit_error|overloaded_error' && return 0
  tail -n 20 "$1" | grep -qE '"is_error"[[:space:]]*:[[:space:]]*true' \
    && tail -n 20 "$1" | grep -qiE 'usage limit|too many requests|overloaded|quota'
}

# Terseness directive injected into the system prompt to save tokens.
TERSE="Be extremely terse in your prose. No preamble, no recap, no explanation of \
what you are about to do. Act directly through tools. One line maximum between two \
actions. Only write sentences when strictly necessary."

# Goal (focuses the model; the loop itself decides when to stop, via folder state).
GOAL="Execute every plan file found in every folder named '$PLANS_DIRNAME' in this \
repo until no task box remains unchecked, honoring the verification steps written \
inside each plan."

# Working prompt: one invocation must advance AS FAR AS POSSIBLE (ideally finish
# everything), not just one task. Fully agnostic: no technology imposed.
read -r -d '' PROMPT <<EOF
/goal $GOAL

Strictly follow the repo's conventions (root CLAUDE.md / AGENTS.md if present):
code style, testing policy, commit format and signature.

Work loop — DO NOT STOP after a single task or a single plan, keep going:
1. Find every folder named "$PLANS_DIRNAME" in the repo (excluding node_modules and
   .git) and list their *.md plan files (README.md excluded). While any plan holds
   an unchecked box "- [ ]", take the OLDEST one (filename order is chronological;
   on a tie, full path order).
2. Execute it task by task with the superpowers:executing-plans skill: follow the
   plan's steps in order (test first if it is TDD, otherwise the described
   procedure), run the "Verify" checks exactly as written IN the plan, and tick
   each step "- [ ]" -> "- [x]" as you go.
3. COMMIT RULE (mandatory): the moment a task's steps all pass, make EXACTLY ONE
   git commit containing that task's changes — following the repo's commit
   conventions — BEFORE starting the next task. Never batch several tasks into one
   commit; never leave a completed task uncommitted; never commit a task whose
   verification failed.
4. When all of a plan's boxes are checked, apply the plan's closing instruction
   (the plan itself says whether to delete it or leave it checked). Then move
   IMMEDIATELY to the next plan. Continue while any unchecked box remains.

Never advance past a task whose verification fails. One commit per completed task.
Go as far as possible in this invocation; the supervisor will re-launch you if needed.
EOF

mkdir -p "$LOGDIR"

echo "▶ Autonomous plan execution"
echo "  Repo    : $WORKDIR"
echo "  Plans   : folders named '$PLANS_DIRNAME' → $(list_plans_dirs | wc -l | tr -d ' ') folder(s), $(count_pending_plans) pending plan(s), $(count_pending_boxes) box(es) to check"
echo "  Model   : $MODEL   Permissions: $PERMISSION_MODE"
echo "  Logs    : $LOGDIR"

stall=0

for ((i = 1; i <= MAX_ITER; i++)); do
  # === Stop authority: no box left unchecked -> done. ===
  current="$(count_pending_boxes)"
  if [[ "$current" == "0" ]]; then
    echo ""
    echo "✅ All plans executed (no unchecked box left in any '$PLANS_DIRNAME' folder)."
    exit 0
  fi

  TS="$(date '+%Y-%m-%d_%H-%M-%S')"
  LOG="$LOGDIR/iter-$(printf '%03d' "$i")-$TS.log"
  echo ""
  echo "=== Iteration $i / $MAX_ITER — $TS — boxes left: $current ==="

  # --continue: resume the previous session (context preserved, auto-compacted).
  if [[ "$STREAM" == "1" ]]; then
    claude -p "$PROMPT" \
      --continue \
      --model "$MODEL" \
      --max-turns "$MAX_TURNS" \
      --permission-mode "$PERMISSION_MODE" \
      --append-system-prompt "$TERSE" \
      --verbose --output-format stream-json 2>&1 | tee "$LOG" | format_stream
  else
    claude -p "$PROMPT" \
      --continue \
      --model "$MODEL" \
      --max-turns "$MAX_TURNS" \
      --permission-mode "$PERMISSION_MODE" \
      --append-system-prompt "$TERSE" \
      --output-format text 2>&1 | tee "$LOG"
  fi

  # Usage limit: long pause then re-launch WITHOUT counting as a stall.
  if hit_usage_limit "$LOG"; then
    echo "⏳ Usage limit hit. Pausing ${LIMIT_SLEEP}s before re-launch…"
    sleep "$LIMIT_SLEEP"
    continue
  fi

  # Progress = at least one more box checked during this iteration.
  after="$(count_pending_boxes)"
  if [[ "$after" == "0" ]]; then
    echo ""
    echo "✅ All plans executed (iteration $i)."
    exit 0
  fi
  if (( after < current )); then
    stall=0
  else
    stall=$((stall + 1))
    echo "… no progress this turn (stalled: $stall/$STALL_LIMIT)."
  fi

  if (( stall >= STALL_LIMIT )); then
    echo "⚠ $STALL_LIMIT consecutive turns without progress — stopping. See $LOG."
    exit 1
  fi

  sleep "$COOLDOWN"
done

echo "⚠ MAX_ITER=$MAX_ITER cap reached. Boxes left: $(count_pending_boxes). See $LOGDIR."
exit 1
