"""
JWKS Auto-Refresh Service (300s TTL)

Implements §1.4 of the design doc: automatic JWKS key sync between
Keycloak and Kong every 300 seconds. Bridges the gap between Kong's
built-in JWT plugin (static key) and the designed OIDC plugin behavior
(jwks_uri_refresh_interval: 300).

On each cycle:
  1. Fetch the current signing key from Keycloak JWKS endpoint
  2. Compare kid with the last known kid
  3. If changed (key rotation detected): update Kong JWT credential
  4. Sleep 300s
"""
import base64
import json
import logging
import os
import time
import urllib.request

import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [jwks-refresher] %(levelname)s %(message)s",
)
log = logging.getLogger("jwks-refresher")

KONG_ADMIN = os.environ.get("KONG_ADMIN_URL", "http://kong:8001")
KC_BASE = os.environ.get("KEYCLOAK_URL", "http://keycloak-lb:8080")
REALM = os.environ.get("KEYCLOAK_REALM", "aeroflow")
CONSUMER = os.environ.get("KONG_CONSUMER", "keycloak-users")
REFRESH_INTERVAL = int(os.environ.get("REFRESH_INTERVAL_SECONDS", "300"))

JWKS_URL = f"{KC_BASE}/realms/{REALM}/protocol/openid-connect/certs"
ISSUER = f"{KC_BASE}/realms/{REALM}"

_last_kid: str = ""


def b64url_to_int(s: str) -> int:
    s += "=" * (-len(s) % 4)
    return int.from_bytes(base64.urlsafe_b64decode(s), "big")


def enc_len(l: int) -> bytes:
    if l < 128:
        return bytes([l])
    if l < 256:
        return bytes([0x81, l])
    return bytes([0x82, l >> 8, l & 0xFF])


def enc_int(n: int) -> bytes:
    b = n.to_bytes((n.bit_length() + 7) // 8, "big")
    if b[0] & 0x80:
        b = b"\x00" + b
    return b"\x02" + enc_len(len(b)) + b


def jwks_to_pem(jwks_url: str) -> tuple[str, str]:
    """Returns (kid, pem_public_key)."""
    with urllib.request.urlopen(jwks_url, timeout=10) as r:
        data = json.load(r)

    rsa_keys = [k for k in data["keys"] if k["kty"] == "RSA"]
    sig_keys = [k for k in rsa_keys if k.get("use") == "sig"]
    key = sig_keys[-1] if sig_keys else rsa_keys[-1]
    kid = key["kid"]

    n = b64url_to_int(key["n"])
    e = b64url_to_int(key["e"])

    rsa_pub = b"\x30" + enc_len(len(enc_int(n) + enc_int(e))) + enc_int(n) + enc_int(e)
    oid = b"\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00"
    bitstring = b"\x03" + enc_len(len(rsa_pub) + 1) + b"\x00" + rsa_pub
    spki = b"\x30" + enc_len(len(oid) + len(bitstring)) + oid + bitstring

    b64 = base64.b64encode(spki).decode()
    pem = (
        "-----BEGIN PUBLIC KEY-----\n"
        + "\n".join(b64[i : i + 64] for i in range(0, len(b64), 64))
        + "\n-----END PUBLIC KEY-----"
    )
    return kid, pem


def update_kong_credential(pem: str) -> None:
    existing = requests.get(f"{KONG_ADMIN}/consumers/{CONSUMER}/jwt", timeout=10)
    existing.raise_for_status()
    for cred in existing.json().get("data", []):
        requests.delete(
            f"{KONG_ADMIN}/consumers/{CONSUMER}/jwt/{cred['id']}", timeout=10
        ).raise_for_status()
        log.info("Deleted old credential %s", cred["id"])

    resp = requests.post(
        f"{KONG_ADMIN}/consumers/{CONSUMER}/jwt",
        json={"algorithm": "RS256", "key": ISSUER, "rsa_public_key": pem},
        timeout=10,
    )
    resp.raise_for_status()
    new_id = resp.json().get("id", "?")
    log.info("Registered new Kong JWT credential %s", new_id)


def refresh_once() -> None:
    global _last_kid
    kid, pem = jwks_to_pem(JWKS_URL)

    if kid == _last_kid:
        log.debug("JWKS kid unchanged (%s), no update needed", kid)
        return

    log.info("JWKS kid changed: %s → %s — updating Kong", _last_kid or "(first run)", kid)
    update_kong_credential(pem)
    _last_kid = kid
    log.info("Kong credential updated for kid=%s", kid)


def wait_for_services(retries: int = 30, delay: int = 10) -> None:
    for attempt in range(1, retries + 1):
        try:
            requests.get(f"{KONG_ADMIN}/status", timeout=5).raise_for_status()
            urllib.request.urlopen(JWKS_URL, timeout=5)
            log.info("Kong and Keycloak are reachable")
            return
        except Exception:
            log.warning("Services not ready, attempt %d/%d, retry in %ds", attempt, retries, delay)
            time.sleep(delay)
    raise RuntimeError("Services unavailable after retries")


def main():
    log.info(
        "Starting JWKS refresher — interval=%ds, kong=%s, keycloak=%s",
        REFRESH_INTERVAL,
        KONG_ADMIN,
        KC_BASE,
    )
    wait_for_services()

    while True:
        try:
            refresh_once()
        except Exception as e:
            log.error("Refresh failed: %s", e)
        time.sleep(REFRESH_INTERVAL)


if __name__ == "__main__":
    main()
