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
#   PLANS_DIRNAME=plans MODEL=claude-sonnet-5 EFFORT=low MAX_ITER=500 ./scripts/run-plans.sh
#   WORKDIR=/path/to/another/repo ./scripts/run-plans.sh
#   FRESH=1 ./scripts/run-plans.sh          # new Claude session (no --continue)
#   EFFORT=medium ./scripts/run-plans.sh   # raise if low effort skips needed reasoning
#
# Stop: Ctrl-C; no unchecked box left; STALL_LIMIT consecutive turns without
# progress; or MAX_ITER.

set -u

# --- Configuration (overridable via environment variables) -------------------
WORKDIR="${WORKDIR:-$PWD}"                        # target repo = current directory
PLANS_DIRNAME="${PLANS_DIRNAME:-plans}"  # name of the folders to scan (any parent)
MODEL="${MODEL:-claude-opus-4-8}"
EFFORT="${EFFORT:-low}"              # low|medium|high|xhigh|max — low = fewer thinking tokens
MAX_ITER="${MAX_ITER:-300}"          # safety cap (number of re-launches)
MAX_TURNS="${MAX_TURNS:-200}"        # max turns per invocation
COOLDOWN="${COOLDOWN:-10}"           # normal pause between two re-launches (s)
LIMIT_SLEEP="${LIMIT_SLEEP:-1800}"   # pause when a usage limit is hit (s = 30 min)
STALL_LIMIT="${STALL_LIMIT:-4}"      # consecutive no-progress turns before giving up
LOGDIR="${LOGDIR:-$WORKDIR/.plan-logs}"
STREAM="${STREAM:-1}"                # 1 = watch everything live (tools, reasoning); 0 = final output only
PERMISSION_MODE="${PERMISSION_MODE:-bypassPermissions}"  # full autonomy; set to "default" to confirm
FRESH="${FRESH:-0}"                  # 1 = skip --continue (new Claude session)

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

# Detect a REAL usage/rate/session limit. Prefer structured stream-json signals
# (absent from normal business content). Claude Code emits e.g.:
#   {"type":"rate_limit_event","rate_limit_info":{"status":"rejected","resetsAt":…}}
#   "error":"rate_limit" / "api_error_status":429
#   result text: "You've hit your session limit · resets 2:50am (…)"
# Avoid bare words like "429" alone (false positives in file contents).
hit_usage_limit() {
  local log="$1"
  # Precise: rate_limit_info.status == rejected (not overageStatus:"rejected")
  grep -qE '"rate_limit_info"[[:space:]]*:[[:space:]]*\{[^}]*"status"[[:space:]]*:[[:space:]]*"rejected"' "$log" && return 0
  grep -qE '"error"[[:space:]]*:[[:space:]]*"rate_limit"' "$log" && return 0
  grep -qE '"api_error_status"[[:space:]]*:[[:space:]]*429' "$log" && return 0
  grep -qiE 'rate_limit_error|overloaded_error' "$log" && return 0
  # Human-readable envelope (stream-json result or text mode)
  grep -qE '"is_error"[[:space:]]*:[[:space:]]*true' "$log" \
    && grep -qiE 'session limit|usage limit|too many requests|overloaded|quota' "$log" && return 0
  # Text-only output (STREAM=0): no JSON envelope
  grep -qiE "You've hit your (session|usage) limit" "$log"
}

# Seconds to sleep until the quota resets. Prefer resetsAt (unix) from the
# rate_limit_event; fall back to LIMIT_SLEEP when absent (e.g. text mode).
# Adds a small buffer so the first re-launch is not still rejected.
limit_sleep_seconds() {
  local log="$1"
  local resets_at now sleep_s
  resets_at=$(grep -oE '"resetsAt"[[:space:]]*:[[:space:]]*[0-9]+' "$log" \
    | tail -n1 | grep -oE '[0-9]+$' || true)
  if [[ -n "$resets_at" ]]; then
    now=$(date +%s)
    sleep_s=$((resets_at - now + 60))   # +60s buffer after reset
    if (( sleep_s < 60 )); then
      sleep_s=60                         # already past / clock skew → retry soon
    fi
    echo "$sleep_s"
    return
  fi
  echo "$LIMIT_SLEEP"
}

# Sleep while printing a live HH:MM:SS countdown on one line (Ctrl-C still works).
countdown_sleep() {
  local total="$1" left h m s
  left=$total
  while (( left > 0 )); do
    h=$((left / 3600))
    m=$(((left % 3600) / 60))
    s=$((left % 60))
    printf '\r   ⏱  resume in %02d:%02d:%02d  ' "$h" "$m" "$s"
    sleep 1
    left=$((left - 1))
  done
  printf '\r   ⏱  resume in 00:00:00 — relaunching.\n'
}

# Absolute silence: zero assistant prose (biggest output-token saver).
TERSE="TOKEN BUDGET — CRITICAL:
- Emit ZERO assistant text. No preamble, recap, plan, status, apology, or summary.
- Tools only. If a text block is unavoidable, max 5 words (e.g. DONE or BLOCKED:<reason>).
- Do NOT narrate. Do NOT quote file contents in text. Do NOT restate the plan.
- Do NOT use Task/subagents/parallel agents. Do NOT invoke long skills.
- Do NOT explore broadly: open only files required for the current step.
- Prefer Edit/Patch over rewriting whole files. Prefer targeted greps over full reads."

# Goal (short — re-sent every iteration; keep input tokens low).
GOAL="Drain every '$PLANS_DIRNAME' folder: tick all '- [ ]' boxes. Follow each plan's Verify steps."

# Compact work prompt (agnostic). Rules only — no fluff.
read -r -d '' PROMPT <<EOF
/goal $GOAL

Silence. Tools only. Honor repo CLAUDE.md/AGENTS.md (style, tests, commits).

Loop (do not stop after one task/plan):
1. Oldest plan *.md under any '$PLANS_DIRNAME/' (skip README, node_modules, .git) with unchecked '- [ ]'.
2. Do its next unchecked task in order (TDD: test first if plan says so). Run Verify exactly as written. Tick '- [ ]'→'- [x]'.
3. On pass: exactly ONE git commit for that task (repo commit rules), then next task. Never batch commits. Never commit a failed Verify.
4. Plan done → apply its closing instruction (delete or leave checked) → next plan.

Stop only if Verify fails. Go as far as possible; supervisor re-launches.
EOF

mkdir -p "$LOGDIR"

echo "▶ Autonomous plan execution"
echo "  Repo    : $WORKDIR"
echo "  Plans   : folders named '$PLANS_DIRNAME' → $(list_plans_dirs | wc -l | tr -d ' ') folder(s), $(count_pending_plans) pending plan(s), $(count_pending_boxes) box(es) to check"
echo "  Model   : $MODEL   Effort: $EFFORT   Permissions: $PERMISSION_MODE"
echo "  Session : $([[ "$FRESH" == "1" ]] && echo "FRESH (no --continue)" || echo "continue previous")"
echo "  Logs    : $LOGDIR"

stall=0
use_continue=1
if [[ "$FRESH" == "1" ]]; then
  use_continue=0
fi

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

  continue_args=()
  if [[ "$use_continue" == "1" ]]; then
    continue_args=(--continue)
  else
    echo "  (fresh session — not using --continue)"
    use_continue=1   # subsequent iterations resume this new session
  fi

  # --continue: resume the previous session (context preserved, auto-compacted).
  if [[ "$STREAM" == "1" ]]; then
    claude -p "$PROMPT" \
      "${continue_args[@]}" \
      --model "$MODEL" \
      --effort "$EFFORT" \
      --max-turns "$MAX_TURNS" \
      --permission-mode "$PERMISSION_MODE" \
      --append-system-prompt "$TERSE" \
      --verbose --output-format stream-json 2>&1 | tee "$LOG" | format_stream
  else
    claude -p "$PROMPT" \
      "${continue_args[@]}" \
      --model "$MODEL" \
      --effort "$EFFORT" \
      --max-turns "$MAX_TURNS" \
      --permission-mode "$PERMISSION_MODE" \
      --append-system-prompt "$TERSE" \
      --output-format text 2>&1 | tee "$LOG"
  fi

  # Usage / session limit: sleep until resetsAt (or LIMIT_SLEEP), then re-launch.
  # Do NOT count as a stall — the model could not work.
  if hit_usage_limit "$LOG"; then
    sleep_s="$(limit_sleep_seconds "$LOG")"
    resume_at="$(date -v+"${sleep_s}S" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null \
      || date -d "+${sleep_s} seconds" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null \
      || echo "in ${sleep_s}s")"
    echo "⏳ Session/usage limit hit. Pausing ${sleep_s}s (~$((sleep_s / 60)) min) — resume ~ ${resume_at} ..."
    countdown_sleep "$sleep_s"
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
