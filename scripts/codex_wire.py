import os, re
P = os.path.expanduser("~/.codex/config.toml")
t = open(P, encoding="utf-8").read()
t = re.sub(r'wire_api\s*=\s*"chat"', 'wire_api = "responses"', t)
if 'wire_api' not in t:
    t = t.replace('env_key = "FREELMAPI_API_KEY"', 'env_key = "FREELMAPI_API_KEY"\nwire_api = "responses"')
open(P, "w", encoding="utf-8").write(t)
print("wire_api = responses")