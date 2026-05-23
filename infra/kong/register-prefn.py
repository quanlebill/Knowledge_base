"""Register Kong pre-function plugin that injects X-User-* headers from JWT."""
import json, urllib.request, urllib.error, sys, os

# Allow override via env (e.g. when running inside a Docker container)
KONG = os.environ.get("KONG_ADMIN_URL", "http://localhost:8001")
SERVICE = "aeroflow-backend"

# Pure Lua string-pattern approach — no require/cjson needed in Kong sandbox
LUA = r"""
local auth = kong.request.get_header("Authorization")
if not auth then return end
local token = auth:match("Bearer%s+(.+)")
if not token then return end
local b64 = token:match("^[^.]+%.([^.]+)%.")
if not b64 then return end
b64 = b64:gsub("-", "+"):gsub("_", "/")
b64 = b64 .. string.rep("=", (4 - #b64 % 4) % 4)
local j = ngx.decode_base64(b64)
if not j then return end
local sub         = j:match('"sub"%s*:%s*"([^"]+)"')
local email       = j:match('"email"%s*:%s*"([^"]+)"')
local roles_block = j:match('"realm_access"%s*:%s*{[^}]*"roles"%s*:%s*%[([^%]]*)%]')
local roles = ""
if roles_block then
  local t = {}
  for r in roles_block:gmatch('"([^"]+)"') do t[#t+1] = r end
  roles = table.concat(t, ",")
end
if sub   then kong.service.request.set_header("X-User-Id",    sub)   end
if email then kong.service.request.set_header("X-User-Email", email) end
if roles ~= "" then kong.service.request.set_header("X-User-Roles", roles) end
kong.service.request.set_header("X-Kong-Verified", "true")
"""

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
