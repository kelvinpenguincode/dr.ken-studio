#!/usr/bin/env bash
# Usage (no chmod needed):
#   bash ~/dr.ken-studio/ios/DrKenStudio/verify-push-entitlements.sh
#   bash verify-push-entitlements.sh /path/to/App.xcarchive
#   bash verify-push-entitlements.sh /path/to/Exported.ipa

set -euo pipefail

TARGET="${1:-}"
APP=""
TMP=""

cleanup() {
  if [[ -n "${TMP}" && -d "${TMP}" ]]; then
    rm -rf "${TMP}"
  fi
}
trap cleanup EXIT

if [[ -n "$TARGET" ]]; then
  if [[ "$TARGET" == *.ipa ]]; then
    TMP=$(mktemp -d)
    unzip -q "$TARGET" -d "$TMP"
    APP=$(find "$TMP/Payload" -name "*.app" -maxdepth 1 | head -1)
    echo "Checking EXPORTED IPA (this is what matters for TestFlight):"
    echo "  $TARGET"
  elif [[ "$TARGET" == *.xcarchive ]]; then
    APP=$(find "$TARGET/Products/Applications" -name "*.app" -maxdepth 1 | head -1)
    echo "Checking raw Xcode ARCHIVE (often still Development-signed BEFORE upload):"
    echo "  $TARGET"
    echo "NOTE: App Store / TestFlight upload re-signs. Prefer verifying an exported .ipa."
  elif [[ "$TARGET" == *.app ]]; then
    APP="$TARGET"
  else
    echo "Pass a .ipa, .xcarchive, or .app path"
    exit 1
  fi
else
  echo "Recent archives (raw archive may still say development — that can be OK):"
  ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -5 | nl || true
  echo ""
  ARCHIVE=$(ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -1 || true)
  if [[ -z "$ARCHIVE" ]]; then
    echo "No archives found."
    exit 1
  fi
  echo "Checking newest archive:"
  echo "  $ARCHIVE"
  echo ""
  echo "IMPORTANT: Codesign on the .xcarchive often shows aps-environment=development"
  echo "even when Archive=Release. Xcode re-signs to production when you"
  echo "Distribute App → App Store Connect. To verify for real:"
  echo "  Organizer → Distribute App → App Store Connect → Export (save .ipa)"
  echo "  bash verify-push-entitlements.sh /path/to/YourApp.ipa"
  echo ""
  APP=$(find "$ARCHIVE/Products/Applications" -name "*.app" -maxdepth 1 | head -1)
fi

if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "Could not find .app"
  exit 1
fi

echo "App: $APP"
echo ""

echo "=== Bundle / version ==="
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist" 2>/dev/null || true
echo "Version: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist" 2>/dev/null || echo '?')"
echo "Build:    $(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist" 2>/dev/null || echo '?')"
echo ""

echo "=== Codesign entitlements ==="
ENTITLEMENTS=$(codesign -d --entitlements :- "$APP" 2>/dev/null || true)
if [[ -z "$ENTITLEMENTS" ]]; then
  echo "FAILED to read codesign entitlements"
  exit 1
fi
echo "$ENTITLEMENTS" | plutil -p - 2>/dev/null || echo "$ENTITLEMENTS"
APS=$(echo "$ENTITLEMENTS" | plutil -extract aps-environment raw - 2>/dev/null || true)
echo ""
echo ">>> aps-environment = ${APS:-NOT FOUND}"
echo ""

echo "=== Signing authority ==="
codesign -dv --verbose=2 "$APP" 2>&1 | grep -E 'Authority|TeamIdentifier' || true
echo ""

if [[ -f "$APP/embedded.mobileprovision" ]]; then
  echo "=== Profile ==="
  SECURITY_OUT=$(security cms -D -i "$APP/embedded.mobileprovision" 2>/dev/null || true)
  echo "$SECURITY_OUT" | plutil -extract Name raw - 2>/dev/null | sed 's/^/Name: /' || true
  echo "$SECURITY_OUT" | plutil -extract Entitlements.aps-environment raw - 2>/dev/null | sed 's/^/Profile aps-environment: /' || true
  GTA=$(echo "$SECURITY_OUT" | plutil -extract Entitlements.get-task-allow raw - 2>/dev/null || echo "?")
  echo "get-task-allow: $GTA"
fi

echo ""
if [[ "$TARGET" == *.ipa ]]; then
  if [[ "$APS" == "production" ]]; then
    echo "OK — this IPA is production-signed. Upload/install this build."
    exit 0
  else
    echo "NOT OK — exported IPA is still development. Fix Archive scheme=Release and Distribution cert, then export again."
    exit 2
  fi
fi

if [[ "$APS" == "production" ]]; then
  echo "OK — archive already shows production."
elif [[ "$APS" == "development" ]]; then
  echo "Archive shows development (common BEFORE App Store export)."
  echo "Next: Organizer → Distribute App → App Store Connect → Upload"
  echo "Or Export an .ipa and re-run this script on the .ipa to confirm production."
else
  echo "Could not read aps-environment."
  exit 2
fi
