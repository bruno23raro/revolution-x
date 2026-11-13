#!/usr/bin/env python3
import argparse, json, os, secrets, string, subprocess, sys, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_env():
    env = {}
    for f in (".env.local", ".env"):
        p = os.path.join(ROOT, f)
        if not os.path.isfile(p):
            continue
        for line in open(p, encoding="utf-8", errors="replace"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env

env = load_env()
base = (env.get("NEXT_PUBLIC_SUPABASE_URL") or "http://127.0.0.1:54321").rstrip("/")
svc = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE") or ""

p = argparse.ArgumentParser()
p.add_argument("--create", action="store_true")
p.add_argument("--reset", action="store_true")
p.add_argument("--email")
p.add_argument("--password")
a = p.parse_args()

def call(method, path, body=None):
    req = urllib.request.Request(base + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"apikey": svc, "Authorization": "Bearer " + svc,
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read(400).decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)

if not svc:
    print("SUPABASE_SERVICE_ROLE_KEY ausente em .env.local"); sys.exit(1)

st, users = call("GET", "/auth/v1/admin/users?per_page=200")
if st != 200:
    print("falha ao listar:", st, users); sys.exit(1)

lst = users.get("users", [])
print("usuarios:", len(lst))
for u in lst:
    print(" -", u.get("email"), "| criado:", u.get("created_at"),
          "| confirmado:", bool(u.get("email_confirmed_at")),
          "| ultimo_login:", u.get("last_sign_in_at"))

if a.create:
    email = a.email or ("dev+" + "".join(secrets.choice(string.ascii_lowercase) for _ in range(6)) + "@revolutionx.local")
    pwd = a.password or ("Dev#" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10)))
    st, res = call("POST", "/auth/v1/admin/users",
                   {"email": email, "password": pwd, "email_confirm": True})
    print("\nCRIAR:", st)
    if st in (200, 201):
        print("EMAIL:", email)
        print("SENHA:", pwd)
    else:
        print(res)
        sys.exit(2)

if a.reset:
    email = a.email
    target = next((u for u in lst if u.get("email") == email), None) if email else (lst[0] if lst else None)
    if not target:
        print("nenhum usuario para resetar"); sys.exit(3)
    pwd = a.password or ("Dev#" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10)))
    st, res = call("PUT", "/auth/v1/admin/users/" + target["id"],
                   {"password": pwd, "email_confirm": True})
    print("\nRESET:", st, target.get("email"))
    if st == 200:
        print("EMAIL:", target.get("email"))
        print("SENHA:", pwd)
    else:
        print(res)