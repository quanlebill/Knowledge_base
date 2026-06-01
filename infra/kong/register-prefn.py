"""
⛔  DEPRECATED — DO NOT USE OR RUN THIS FILE.

This script was an early prototype that injected identity headers via a Kong
pre-function plugin.  It has critical security flaws and is superseded by the
`aeroflow-jwks` custom plugin (infra/kong/plugins/aeroflow-jwks/).

Why it is unsafe:
  1. The Lua code base64-decodes the JWT payload with regex but NEVER verifies
     the RS256 signature.  Any attacker can forge a token with arbitrary claims
     and get X-Kong-Verified: true injected.
  2. Claims exp, nbf, iss, and aud are not validated.
  3. JSON is parsed with Lua string patterns — fragile and bypassable.
  4. Incoming X-User-* headers are not cleared before being set, enabling
     header-injection on routes that skip this plugin.
  5. The script calls Kong Admin API without any authentication.

The aeroflow-jwks plugin fixes all of the above:
  - Full RS256 signature verification via resty.openssl
  - exp / nbf / iss / aud validation
  - Proper cjson JSON parsing
  - Incoming headers cleared before injection (clear_header calls)
  - Schema-validated configuration

To set up Kong authentication, run:
  bash infra/kong/kong-setup.sh
"""

raise SystemExit(
    "\n⛔  This file is DEPRECATED and must not be executed.\n"
    "   Use infra/kong/kong-setup.sh to configure the aeroflow-jwks plugin instead.\n"
)

def api(method, path, body=None):
    url = KONG + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data,
          headers={"Content-Type": "application/json"} if data else {},
          method=method)
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            return (json.loads(body) if body else {}), r.status
    except urllib.error.HTTPError as e:
        body = e.read()
        return (json.loads(body) if body else {}), e.code

# Delete existing pre-function plugins on this service
plugins, _ = api("GET", f"/services/{SERVICE}/plugins")
for p in plugins.get("data", []):
    if p["name"] == "pre-function":
        _, code = api("DELETE", f"/plugins/{p['id']}")
        print(f"  deleted old pre-function {p['id']} ({code})")

# Register new pre-function
result, code = api("POST", f"/services/{SERVICE}/plugins",
                   {"name": "pre-function", "config": {"access": [LUA]}})
if code in (200, 201):
    print(f"  -> plugin: {result['name']} [{result['id']}]")
else:
    print(f"  ERROR {code}: {result}", file=sys.stderr)
    sys.exit(1)
