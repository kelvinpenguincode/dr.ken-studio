#!/usr/bin/env bash
# Creates a real App Store .ipa from your newest archive, then checks push entitlements.
# Usage (no chmod):
#   bash ~/dr.ken-studio/ios/DrKenStudio/export-and-verify-ipa.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${HOME}/Desktop/DrKenStudio-ipa-export"
ARCHIVE="${1:-}"

if [[ -z "$ARCHIVE" ]]; then
  ARCHIVE=$(ls -td "${HOME}/Library/Developer/Xcode/Archives"/*/*.xcarchive 2>/dev/null | head -1 || true)
fi

if [[ -z "$ARCHIVE" || ! -d "$ARCHIVE" ]]; then
  echo "No .xcarchive found. In Xcode: Product → Archive first."
  exit 1
fi

echo "Archive: $ARCHIVE"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "Exporting App Store IPA (this re-signs for distribution)…"
if ! xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$OUT" \
  -exportOptionsPlist "$ROOT/ExportOptions-AppStore.plist" \
  -allowProvisioningUpdates
then
  echo ""
  echo "Export failed. Trying older method name 'app-store'…"
  TMP_PLIST=$(mktemp)
  /usr/libexec/PlistBuddy -c 'Add :method string app-store' "$TMP_PLIST"
  /usr/libexec/PlistBuddy -c 'Add :signingStyle string automatic' "$TMP_PLIST"
  /usr/libexec/PlistBuddy -c 'Add :destination string export' "$TMP_PLIST"
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE" \
    -exportPath "$OUT" \
    -exportOptionsPlist "$TMP_PLIST" \
    -allowProvisioningUpdates
  rm -f "$TMP_PLIST"
fi

IPA=$(find "$OUT" -name "*.ipa" | head -1)
if [[ -z "$IPA" ]]; then
  echo "No .ipa produced. Folder contents:"
  ls -la "$OUT"
  echo ""
  echo "Open that folder — if you only see .app, export used the wrong method."
  exit 1
fi

echo ""
echo "IPA created: $IPA"
echo "Verifying push entitlements…"
bash "$ROOT/verify-push-entitlements.sh" "$IPA"
STATUS=$?

echo ""
if [[ $STATUS -eq 0 ]]; then
  echo "SUCCESS — IPA is production. Upload THIS build via Organizer (Distribute → Upload),"
  echo "or Transporter, then test on TestFlight."
else
  echo "FAILED — exported IPA is still development."
  echo "On developer.apple.com create an App Store provisioning profile for"
  echo "com.drkenstudio.orders with Push enabled, then in Xcode:"
  echo "  Signing & Capabilities → Release → Manual → select that App Store profile"
  echo "Archive again and re-run this script."
fi
exit $STATUS
