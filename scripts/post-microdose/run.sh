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
exec node post-microdose.js "$@"
