#!/usr/bin/env bash
set -e

REPO_URL="git@github.com:masoud13411115-dev/arc-guard.git"
BRANCH="main"

cd /home/runner/workspace

# Add remote if not already present
if ! git remote get-url github 2>/dev/null; then
  git remote add github "$REPO_URL"
  echo "✓ Remote 'github' added"
else
  git remote set-url github "$REPO_URL"
  echo "✓ Remote 'github' updated"
fi

# Stage the .gitignore updates + workflow file + guide (already committed in main)
echo "Current HEAD: $(git log --oneline -1)"

# Push all commits on main → github/main
git push github "$BRANCH" --force-with-lease
echo "✓ Pushed to github/$BRANCH"
