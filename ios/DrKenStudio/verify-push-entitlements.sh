#!/usr/bin/env bash
# Usage (no chmod needed):
#   bash ~/dr.ken-studio/ios/DrKenStudio/verify-push-entitlements.sh
# Or pass an .app / .xcarchive path:
#   bash verify-push-entitlements.sh ~/Library/Developer/Xcode/Archives/.../Something.xcarchive

set -euo pipefail

TARGET="${1:-}"
APP=""

if [[ -n "$TARGET" ]]; then
  if [[ "$TARGET" == *.xcarchive ]]; then
    APP=$(find "$TARGET/Products/Applications" -name "*.app" -maxdepth 1 | head -1)
  elif [[ "$TARGET" == *.app ]]; then
    APP="$TARGET"
  else
    echo "Pass a .app or .xcarchive path"
    exit 1
  fi
else
  echo "Recent archives:"
  ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -5 | nl || true
  echo ""
  ARCHIVE=$(ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -1 || true)
  if [[ -z "$ARCHIVE" ]]; then
    echo "No archives found. In Xcode: Product → Archive first."
    exit 1
  fi
  echo "Checking newest archive:"
  echo "  $ARCHIVE"
  APP=$(find "$ARCHIVE/Products/Applications" -name "*.app" -maxdepth 1 | head -1)
fi

if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "Could not find .app inside archive"
  exit 1
fi

echo "App:"
echo "  $APP"
echo ""

echo "=== Bundle ID ==="
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist" 2>/dev/null || true
echo "Version: $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist" 2>/dev/null || echo '?')"
echo "Build:    $(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Info.plist" 2>/dev/null || echo '?')"
echo ""

echo "=== aps-environment (codesign) ==="
ENTITLEMENTS=$(codesign -d --entitlements :- "$APP" 2>/dev/null || true)
if [[ -z "$ENTITLEMENTS" ]]; then
  echo "FAILED to read codesign entitlements"
  codesign -d --entitlements :- "$APP" 2>&1 | head -20
  exit 1
fi
echo "$ENTITLEMENTS" | plutil -p - 2>/dev/null || echo "$ENTITLEMENTS"
APS=$(echo "$ENTITLEMENTS" | plutil -extract aps-environment raw - 2>/dev/null || true)
echo ""
echo ">>> aps-environment = ${APS:-NOT FOUND}"
echo ""

echo "=== Signing identity (should mention Distribution / Apple Distribution for TestFlight) ==="
codesign -dv --verbose=2 "$APP" 2>&1 | grep -E 'Authority|TeamIdentifier|Format' || true
echo ""

if [[ -f "$APP/embedded.mobileprovision" ]]; then
  echo "=== Provisioning profile ==="
  SECURITY_OUT=$(security cms -D -i "$APP/embedded.mobileprovision" 2>/dev/null || true)
  echo "$SECURITY_OUT" | plutil -extract Name raw - 2>/dev/null | sed 's/^/Name: /' || true
  echo "$SECURITY_OUT" | plutil -extract Entitlements.aps-environment raw - 2>/dev/null | sed 's/^/Profile aps-environment: /' || true
  # get-task-allow true usually means DEVELOPMENT signing
  GTA=$(echo "$SECURITY_OUT" | plutil -extract Entitlements.get-task-allow raw - 2>/dev/null || echo "?")
  echo "get-task-allow: $GTA  (true = development signing; false/missing = distribution)"
else
  echo "No embedded.mobileprovision (unusual for a local archive)"
fi

echo ""
if [[ "$APS" == "production" ]]; then
  echo "OK — safe to upload this archive to TestFlight."
elif [[ "$APS" == "development" ]]; then
  echo "NOT OK — this archive is DEVELOPMENT-signed."
  echo "Fix in Xcode:"
  echo "  1) Product → Scheme → Edit Scheme → Archive → Build Configuration = Release"
  echo "  2) Target → Signing & Capabilities → for Release, profile must be App Store / Distribution (not Development)"
  echo "  3) Destination = Any iOS Device (arm64), then Product → Archive again"
  echo "  4) Re-run: bash ios/DrKenStudio/verify-push-entitlements.sh"
  exit 2
else
  echo "NOT OK — could not confirm production aps-environment."
  exit 2
fi
