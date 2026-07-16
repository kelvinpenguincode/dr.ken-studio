#!/bin/bash
# Run AFTER Product → Archive, before uploading to TestFlight.
# Usage: ./verify-push-entitlements.sh /path/to/DrKenStudio.app
# Or find the latest archive app automatically.

set -euo pipefail

APP="${1:-}"

if [[ -z "$APP" ]]; then
  ARCHIVE=$(ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -1 || true)
  if [[ -z "$ARCHIVE" ]]; then
    echo "No Xcode archive found. Pass the .app path explicitly."
    exit 1
  fi
  APP=$(find "$ARCHIVE/Products/Applications" -name "*.app" -maxdepth 1 | head -1)
  echo "Using: $APP"
fi

echo "--- aps-environment (must be production for TestFlight) ---"
codesign -d --entitlements :- "$APP" 2>/dev/null | plutil -p - | grep -i aps-environment || {
  echo "Could not read entitlements. Is codesign available?"
  codesign -d --entitlements :- "$APP" 2>&1 | head -50
  exit 1
}

echo "--- bundle id ---"
defaults read "$APP/Info" CFBundleIdentifier 2>/dev/null || true
