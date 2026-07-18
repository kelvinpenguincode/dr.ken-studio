# Fix TestFlight push (poisoned App ID tokens)

## Confirmed working
- APNs `.p8` key + Team ID work (simulator tokens → sandbox HTTP 200)
- Production IPA can show `aps-environment = production` and still mint unusable phone tokens for the **old** App ID

## Broken case (old bundle)
- Bundle `com.drkenstudio.drkenstudio`
- Phone tokens (~64 hex) →
  - production: `BadEnvironmentKeyInToken`
  - sandbox: `BadDeviceToken`
- Reinstall does not help — Apple keeps the same poisoned registration

## Fix: new App ID (current project)

Xcode bundle is now **`com.drkenstudio.orders`**.

### 1. Apple Developer
1. [developer.apple.com](https://developer.apple.com) → **Identifiers** → **+**
2. App ID → Bundle ID: `com.drkenstudio.orders`
3. Enable **Push Notifications** → Save
4. (Optional) Configure Development + Production SSL certs on that App ID — still send with `.p8`

### 2. App Store Connect
1. **Apps** → **+** → new app with bundle `com.drkenstudio.orders`
2. Same team `V355B4A2K9`

### 3. Vercel
Set `APNS_BUNDLE_ID=com.drkenstudio.orders` and redeploy.  
Keep the same `.p8` Key ID / Team ID / private key.

### 4. Mac → ship
```bash
cd ~/dr.ken-studio   # or your clone
git pull
bash ios/DrKenStudio/ship-testflight-push.sh
```
Confirm IPA `aps-environment = production`, upload to the **new** App Store Connect app.

### 5. Phone
1. Delete the **old** Dr. Ken Studio app
2. Admin → Clear device tokens
3. Install from the **new** TestFlight app
4. Enable & sync → Mac-test the new 64-char token → expect **production HTTP 200**
