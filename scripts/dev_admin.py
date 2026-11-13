#!/usr/bin/env python3
import json, os, re, secrets, string, subprocess, sys, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCKER = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "DockerDesktop", "resources", "bin", "docker.exe")
if not os.path.isfile(DOCKER):
    DOCKER = "docker"

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
base = (env.get("NEXT_PUBLIC_SUPABASE_URL") or "http://127.0.0.1:8432").rstrip("/")
svc = env.get("SUPABASE_SERVICE_ROLE_KEY") or ""

def psql(sql):
    r = subprocess.run([DOCKER, "exec", "supabase-db", "psql", "-U", "postgres", "-d", "postgres",
                        "-t", "-A", "-F", "|", "-c", sql], capture_output=True, text=True)
    return r.stdout.strip(), r.stderr.strip()

def call(method, path, body=None, token=None):
    req = urllib.request.Request(base + path, method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"apikey": svc, "Authorization": "Bearer " + (token or svc),
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read(400).decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)

print("== descoberta de papel no banco")
cols, _ = psql("select table_name||'.'||column_name||' :: '||coalesce(udt_name,'') "
               "from information_schema.columns where table_schema='public' "
               "and column_name in ('role','is_admin','is_super_admin','admin')")
print(cols or "  nenhuma coluna de papel encontrada")
labels, _ = psql("select t.typname||'='||e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid")
print("enum:", labels or "  sem enum")

if not cols:
    print("\nsem coluna de papel: admin provavelmente vem de lista em codigo. Rode:")
    print("  Get-ChildItem -Recurse src -Include *.ts | Select-String 'requireAdmin|ADMIN_EMAILS|isAdmin'")
    sys.exit(4)

email = sys.argv[1] if len(sys.argv) > 1 else ("admin+" + "".join(secrets.choice(string.ascii_lowercase) for _ in range(6)) + "@revolutionx.local")
pwd = sys.argv[2] if len(sys.argv) > 2 else ("Adm#" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12)))

st, res = call("POST", "/auth/v1/admin/users", {"email": email, "password": pwd, "email_confirm": True})
print("\nCRIAR USUARIO:", st)
if st not in (200, 201):
    print(res); sys.exit(2)
uid = res.get("id")
print("uid:", uid)

valor = "admin"
m = re.search(r"=(admin[a-z_]*)", labels, re.I)
if m:
    valor = m.group(1)

print("\n== aplicando papel:", valor)
for linha in cols.splitlines():
    tabela, resto = linha.split(".", 1)
    coluna = resto.split(" ::")[0].strip()
    ref, _ = psql(f"select column_name from information_schema.columns where table_schema='public' "
                  f"and table_name='{tabela}' and column_name in ('user_id','id') limit 1")
    if not ref:
        print(f"  {tabela}.{coluna}: sem coluna de referencia, pulando"); continue
    out, err = psql(f"update public.{tabela} set {coluna}='{valor}' where {ref}='{uid}' returning {coluna}")
    if err:
        print(f"  {tabela}.{coluna}: ERRO {err.splitlines()[0][:120]}"); continue
    if out:
        print(f"  {tabela}.{coluna} = {out} (linha existente atualizada)")
    else:
        out2, err2 = psql(f"insert into public.{tabela} ({ref}, {coluna}) values ('{uid}','{valor}') returning {coluna}")
        print(f"  {tabela}.{coluna} = {out2 or 'FALHOU'} {err2.splitlines()[0][:100] if err2 else ''}")

print("\n== conferindo no banco")
for linha in cols.splitlines():
    tabela, resto = linha.split(".", 1)
    coluna = resto.split(" ::")[0].strip()
    out, _ = psql(f"select coalesce({coluna}::text,'null') from public.{tabela} "
                  f"where {'user_id' if 'user_id' in linha or True else 'id'}='{uid}' limit 1")
    print(f"  {tabela}.{coluna} -> {out or 'sem linha'}")

print("\nEMAIL:", email)
print("SENHA:", pwd)
print("UID:", uid)