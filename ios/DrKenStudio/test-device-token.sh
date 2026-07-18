#!/usr/bin/env bash
# Test one device token against Apple directly (bypasses Vercel).
# Usage:
#   bash test-device-token.sh \
#     --key-id YOUR_KEY_ID \
#     --team-id YOUR_TEAM_ID \
#     --p8 /path/to/AuthKey_XXX.p8 \
#     --bundle com.drkenstudio.orders \
#     --token PASTE_FULL_HEX_TOKEN_FROM_PHONE
#
# Requires: openssl, python3, curl with HTTP/2

set -euo pipefail

KEY_ID=""
TEAM_ID=""
P8=""
BUNDLE="com.drkenstudio.orders"
TOKEN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key-id) KEY_ID="$2"; shift 2 ;;
    --team-id) TEAM_ID="$2"; shift 2 ;;
    --p8) P8="$2"; shift 2 ;;
    --bundle) BUNDLE="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$KEY_ID" || -z "$TEAM_ID" || -z "$P8" || -z "$TOKEN" ]]; then
  echo "Missing required args. See header comment."
  exit 1
fi

TOKEN=$(echo "$TOKEN" | tr '[:upper:]' '[:lower:]' | tr -d ' \n\r')
echo "Token length: ${#TOKEN}"
echo "Bundle: $BUNDLE"
echo "Key ID: $KEY_ID  Team ID: $TEAM_ID"
echo ""

JWT=$(KEY_ID="$KEY_ID" TEAM_ID="$TEAM_ID" P8="$P8" python3 - <<'PY'
import os, time, json, base64, subprocess, tempfile

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

key_id = os.environ["KEY_ID"]
team_id = os.environ["TEAM_ID"]
p8 = open(os.environ["P8"], "rb").read()

header = b64url(json.dumps({"alg": "ES256", "kid": key_id}, separators=(",", ":")).encode())
claims = b64url(json.dumps({"iss": team_id, "iat": int(time.time())}, separators=(",", ":")).encode())
signing_input = f"{header}.{claims}".encode()

with tempfile.NamedTemporaryFile(delete=False) as msg, tempfile.NamedTemporaryFile(delete=False) as sig, tempfile.NamedTemporaryFile(delete=False) as keyfile:
    msg.write(signing_input)
    msg.flush()
    keyfile.write(p8)
    keyfile.flush()
    msg_path, sig_path, key_path = msg.name, sig.name, keyfile.name

subprocess.check_call([
    "openssl", "dgst", "-sha256", "-sign", key_path, "-out", sig_path, msg_path
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Convert DER ECDSA signature to raw R||S (IEEE P1363) for JWT
der = open(sig_path, "rb").read()
# Minimal DER parse for SEQUENCE { INT r, INT s }
assert der[0] == 0x30
def read_int(buf, i):
    assert buf[i] == 0x02
    ln = buf[i+1]
    val = buf[i+2:i+2+ln]
    return val, i+2+ln
i = 2
if der[1] & 0x80:
    i = 3  # long form length — uncommon for these sigs; keep simple
r, i = read_int(der, i)
s, i = read_int(der, i)
r = r.lstrip(b"\x00").rjust(32, b"\x00")[-32:]
s = s.lstrip(b"\x00").rjust(32, b"\x00")[-32:]
sig_raw = r + s
print(f"{header}.{claims}.{b64url(sig_raw)}")
PY
)

PAYLOAD='{"aps":{"alert":{"title":"Mac APNs test","body":"Direct from your Mac"},"sound":"default"}}'

send() {
  local HOST="$1"
  local LABEL="$2"
  echo "=== $LABEL ($HOST) ==="
  curl -sS --http2 \
    -o /tmp/apns-body.txt \
    -w "HTTP %{http_code}\n" \
    -X POST "https://${HOST}/3/device/${TOKEN}" \
    -H "authorization: bearer ${JWT}" \
    -H "apns-topic: ${BUNDLE}" \
    -H "apns-push-type: alert" \
    -H "apns-priority: 10" \
    -H "content-type: application/json" \
    --data "$PAYLOAD" || true
  echo "Body: $(cat /tmp/apns-body.txt)"
  echo ""
}

send "api.push.apple.com" "PRODUCTION"
send "api.sandbox.push.apple.com" "SANDBOX"

echo "Interpretation:"
echo "  production OK            → token is production (TestFlight/App Store)"
echo "  sandbox OK               → token is development (Xcode debug)"
echo "  BadEnvironmentKeyInToken on production → Apple thinks token is sandbox"
echo "  BadDeviceToken on both   → token string is wrong/corrupt, or topic/key mismatch"
