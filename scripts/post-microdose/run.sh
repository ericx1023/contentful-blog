#!/bin/bash
# launchd wrapper: loads nvm so node resolves correctly even after nvm upgrades,
# and exports the macOS keychain trust store so Node trusts any corporate root
# CAs (e.g. FortiGate / Zscaler doing TLS interception on a work network).
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

CA_BUNDLE="$HOME/.cache/post-microdose-ca-bundle.pem"
mkdir -p "$(dirname "$CA_BUNDLE")"
{
  security find-certificate -a -p /Library/Keychains/System.keychain
  security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain
  security find-certificate -a -p "$HOME/Library/Keychains/login.keychain-db"
} > "$CA_BUNDLE" 2>/dev/null
export NODE_EXTRA_CA_CERTS="$CA_BUNDLE"

cd "$(dirname "$0")"
node post-microdose.js "$@"
PIPELINE_EXIT=$?

# Auto-publish any new images. Post rows are already live in Turso, but their
# featured_image_path points at /images/<id>/<file> on this Mac — Vercel can't
# serve them until they're in the repo. Trigger a Vercel rebuild by committing
# + pushing whatever the pipeline just dropped into public/images/.
#
# Only runs on full production runs (no CLI args). Test/dry/delete modes don't
# need the auto-publish, and skipping them avoids spurious empty commits.
if [ $PIPELINE_EXIT -eq 0 ] && [ $# -eq 0 ]; then
  REPO_ROOT="$(cd ../.. && pwd)"
  cd "$REPO_ROOT"
  if [ -n "$(git status --porcelain public/images/)" ]; then
    git add public/images/
    if git commit -m "rss: $(date +%Y-%m-%d) image batch [auto]" --no-verify; then
      if git push origin HEAD; then
        echo "[run.sh] ✓ pushed image batch to origin — Vercel will rebuild"
      else
        # SSH agent / auth issue from launchd context. Log + notify so user can
        # do the push manually. The commit is already local so nothing is lost.
        echo "[run.sh] ⚠️ git push failed — commit is local, run 'git push' manually"
        osascript -e 'display notification "Pipeline images committed but push failed — run git push" with title "🍄 Microdose daily ⚠️"' 2>/dev/null || true
      fi
    fi
  fi
fi

exit $PIPELINE_EXIT
