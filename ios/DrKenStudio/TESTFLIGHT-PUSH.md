# TestFlight push fix (no iPhone USB / rented Mac)

## What’s going on
- **Simulator** (~160-char tokens) can work on APNs **sandbox** — that does not mean TestFlight is fixed.
- **Real iPhone / TestFlight** (~64-char tokens) must work on APNs **production**.
- Your `.p8` key + Team ID + bundle ID are fine (simulator already proved that).

## One-command Release ship (recommended)

On the Mac:

```bash
cd ~/dr.ken-studio
git restore .
git pull

export DEVELOPMENT_TEAM=V355B4A2K9   # your Team ID
bash ios/DrKenStudio/ship-testflight-push.sh
```

Only continue if it prints **SUCCESS — IPA is production-signed for push**.

Then upload that archive from Organizer → TestFlight.

## After install on the phone
1. Delete the app + quit Simulator  
2. Admin → Clear device tokens  
3. Reboot iPhone  
4. Install the **new** TestFlight build only  
5. Enable & sync  
6. Mac-test the Admin token — you need:

```text
=== PRODUCTION ===
HTTP 200
```

If PRODUCTION is still `BadEnvironmentKeyInToken`, the installed binary is still not getting production device tokens — say so and we’ll do a new App ID / bundle as a clean break.
