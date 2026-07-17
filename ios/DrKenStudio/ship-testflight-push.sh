#!/usr/bin/env bash
# Build a Release archive, export App Store IPA, verify production push entitlements.
# No iPhone USB needed. Run on the rented Mac:
#
#   export DEVELOPMENT_TEAM=V355B4A2K9   # your 10-char Team ID
#   bash ~/dr.ken-studio/ios/DrKenStudio/ship-testflight-push.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TEAM="${DEVELOPMENT_TEAM:-}"
OUT_DIR="${HOME}/Desktop/DrKenStudio-TestFlight-$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${OUT_DIR}/DrKenStudio.xcarchive"
EXPORT_DIR="${OUT_DIR}/export"

if [[ -z "$TEAM" ]]; then
  echo "Set your Apple Team ID first:"
  echo "  export DEVELOPMENT_TEAM=V355B4A2K9"
  echo "  bash $ROOT/ship-testflight-push.sh"
  exit 1
fi

mkdir -p "$OUT_DIR" "$EXPORT_DIR"
echo "Team:    $TEAM"
echo "Output:  $OUT_DIR"
echo ""

echo "=== 1) Archive (Release, forced) ==="
xcodebuild \
  -project "$ROOT/DrKenStudio.xcodeproj" \
  -scheme DrKenStudio \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  archive | xcpretty 2>/dev/null || xcodebuild \
  -project "$ROOT/DrKenStudio.xcodeproj" \
  -scheme DrKenStudio \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  archive

echo ""
echo "=== 2) Export App Store IPA (re-signs for distribution) ==="
if ! xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$ROOT/ExportOptions-AppStore.plist" \
  -allowProvisioningUpdates
then
  TMP_PLIST=$(mktemp)
  /usr/libexec/PlistBuddy -c 'Add :method string app-store' "$TMP_PLIST"
  /usr/libexec/PlistBuddy -c 'Add :signingStyle string automatic' "$TMP_PLIST"
  /usr/libexec/PlistBuddy -c 'Add :teamID string '"$TEAM" "$TMP_PLIST"
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE" \
    -exportPath "$EXPORT_DIR" \
    -exportOptionsPlist "$TMP_PLIST" \
    -allowProvisioningUpdates
  rm -f "$TMP_PLIST"
fi

IPA=$(find "$EXPORT_DIR" -name "*.ipa" | head -1)
if [[ -z "$IPA" ]]; then
  echo "ERROR: No IPA produced."
  ls -laR "$EXPORT_DIR"
  exit 1
fi

echo ""
echo "=== 3) Verify aps-environment on IPA ==="
bash "$ROOT/verify-push-entitlements.sh" "$IPA"
STATUS=$?

echo ""
if [[ $STATUS -ne 0 ]]; then
  echo "STOP — IPA is not production. Do not upload."
  echo "In Xcode: Signing & Capabilities → Team $TEAM → Push Notifications capability present."
  echo "On developer.apple.com: App ID has Push enabled + Production SSL cert created."
  exit 2
fi

echo "SUCCESS — IPA is production-signed for push."
echo ""
echo "Next:"
echo "  1. Xcode → Organizer → import/open archive at:"
echo "       $ARCHIVE"
echo "     Or: Distribute that archive → App Store Connect → Upload"
echo "  2. Wait for TestFlight Ready"
echo "  3. On iPhone: delete Dr. Ken Studio (and quit Simulator)"
echo "  4. Admin → Clear device tokens"
echo "  5. Reboot iPhone → install NEW TestFlight build only"
echo "  6. Enable & sync → copy token from Admin (expect ~64 chars)"
echo "  7. Mac-test token — need PRODUCTION HTTP 200:"
echo "       bash $ROOT/test-device-token.sh --key-id ... --team-id $TEAM --p8 ... --bundle com.drkenstudio.drkenstudio --token ..."
echo ""
echo "IPA file: $IPA"
