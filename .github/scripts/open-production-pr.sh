#!/usr/bin/env bash
# Opens (or refreshes) the "Production: …" PR from a branch into main after
# that branch's PR merged into staging. Called by sandbox-to-production.yml,
# both when a staging PR merges and from the manual "open missing" run.
#
# Usage: open-production-pr.sh <branch> <staging-pr-number> <staging-pr-title> [merge|backfill]
# Env:   GH_TOKEN, REPO, DRY_RUN (backfill only: "true" prints, opens nothing)
#
# PR creation needs either the repo setting "Allow GitHub Actions to create and
# approve pull requests" or a PRODUCTION_PR_TOKEN secret. If creation fails,
# this comments on the staging PR with the fix and exits non-zero, so the
# failure is visible instead of silent.
set -euo pipefail

branch=$1
pr=$2
title=$3
mode=${4:-merge}
dry_run=${DRY_RUN:-false}

if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
  echo "$branch: branch no longer exists, skipping." | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi
git fetch --quiet origin main "+refs/heads/$branch:refs/remotes/origin/$branch"
ahead=$(git rev-list --count "origin/main..origin/$branch")
if [ "$ahead" = "0" ]; then
  echo "$branch: everything is already on main, skipping." | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi

existing=$(gh pr list --repo "$REPO" --head "$branch" --base main --state open \
  --json number -q '.[0].number')
if [ -n "$existing" ]; then
  if [ "$mode" = "merge" ]; then
    gh pr edit "$existing" --repo "$REPO" --add-label production
    gh pr comment "$existing" --repo "$REPO" --body "Merged into staging again via #$pr."
  fi
  echo "$branch: production PR #$existing already open." | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi

if [ "$mode" = "backfill" ]; then
  # Respect a decision already made: if the newest production PR for this
  # branch was closed without merging, don't reopen it.
  last_closed_unmerged=$(gh pr list --repo "$REPO" --head "$branch" --base main --state closed \
    --json number,mergedAt -q 'sort_by(.number) | last // empty | select(.mergedAt == null) | .number')
  if [ -n "$last_closed_unmerged" ]; then
    echo "$branch: production PR #$last_closed_unmerged was closed without merging; not reopening." | tee -a "$GITHUB_STEP_SUMMARY"
    exit 0
  fi
  if [ "$dry_run" = "true" ]; then
    echo "$branch: would open \"Production: $title\" ($ahead commits not on main, from #$pr)." | tee -a "$GITHUB_STEP_SUMMARY"
    exit 0
  fi
fi

gh label create production --repo "$REPO" --color 0E8A16 \
  --description "Ships to providerinterface.com when merged" 2>/dev/null || true

body=$(printf '%s\n\n%s\n\n%s' \
  "Tested on the sandbox via #$pr. **Merging this PR ships it to production (providerinterface.com).**" \
  "Edits pushed to \`$branch\` update the sandbox and this PR together." \
  "Check the Files tab: it should contain only this change. If it shows unrelated work, the branch was started from staging instead of main.")

err=$(mktemp)
if url=$(gh pr create --repo "$REPO" --base main --head "$branch" \
      --title "Production: $title" --label production --body "$body" 2>"$err"); then
  echo "$branch: opened $url" | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi

reason=$(tr '\n' ' ' < "$err")
echo "::error::Couldn't open the production PR for $branch: $reason"
gh pr comment "$pr" --repo "$REPO" --body "$(printf '%s\n\n%s\n\n%s\n\n%s' \
  "**The production PR for \`$branch\` was not opened automatically.** GitHub said: \`$reason\`" \
  "Until it exists, later pushes to \`$branch\` won't reach the sandbox, and nothing here can ship to production." \
  "Fix once: Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests** → Save (or add a \`PRODUCTION_PR_TOKEN\` secret, see sandbox-to-production.yml)." \
  "Then re-run the failed job, or open Actions → **Sandbox to production** → **Run workflow** to open every missing production PR.")" || true
exit 1
