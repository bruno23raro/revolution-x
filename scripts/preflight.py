#!/usr/bin/env python3
import json, os, shutil, socket, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = {
 "docker": [r"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe",
            r"C:\Program Files\Docker\Docker\resources\bin\docker.exe"],
 "curl":   [r"C:\Windows\System32\curl.exe"],
 "gh":     [r"%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe",
            r"C:\Program Files\GitHub CLI\gh.exe"],
 "psql":   [r"C:\Program Files\PostgreSQL\18\bin\psql.exe"],
 "node": [], "npx": [], "uvx": [], "python": [], "git": [],
}
PORTS = [5432, 55432, 54321, 54320, 27123, 27124, 5678, 3001]
BAD = ["changeme", "xxx", "seu_", "your_", "todo", "placeholder", "<", ">"]
ENVF = [".env", ".env.local", ".env.production", ".env.development"]

def resolve(name, extra):
    for c in extra:
        p = os.path.expandvars(c)
        if os.path.isfile(p):
            return p
    return shutil.which(name) or None

def port(p):
    s = socket.socket(); s.settimeout(0.6)
    try:
        return s.connect_ex(("127.0.0.1", p)) == 0
    finally:
        s.close()

rep = {"ts": datetime.datetime.now().isoformat(), "bins": {}, "pipe": {},
       "ports": {}, "env": {}, "envfiles": {}}
for n, ex in CAND.items():
    rep["bins"][n] = resolve(n, ex)

rep["pipe"]["dockerDesktopLinuxEngine"] = os.path.exists(r"\\.\pipe\dockerDesktopLinuxEngine")
rep["pipe"]["docker_engine"] = os.path.exists(r"\\.\pipe\docker_engine")
rep["ports"] = {str(p): port(p) for p in PORTS}

total = sum(len(k) + len(v) + 1 for k, v in os.environ.items())
big = sorted(((len(k) + len(v), k) for k, v in os.environ.items()), reverse=True)[:15]
rep["env"] = {"total_bytes": total, "limit": 32767, "top": [k for _, k in big]}

for f in ENVF:
    p = os.path.join(ROOT, f)
    if not os.path.isfile(p):
        continue
    probs = []
    with open(p, encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh, 1):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vl = v.strip().strip('"').strip("'")
            if vl == "":
                probs.append({"line": i, "key": k, "why": "vazio"})
            elif any(b in vl.lower() for b in BAD):
                probs.append({"line": i, "key": k, "why": "placeholder"})
            elif "localhost:5432" in vl:
                probs.append({"line": i, "key": k, "why": "localhost:5432"})
    rep["envfiles"][f] = probs

os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
with open(os.path.join(ROOT, "docs", "preflight.json"), "w", encoding="utf-8") as fh:
    json.dump(rep, fh, indent=2, ensure_ascii=False)

for n, p in rep["bins"].items():
    print(n.ljust(8), "OK " + p if p else "FALTA")
print("pipe linux engine:", rep["pipe"]["dockerDesktopLinuxEngine"])
print("env total:", total, "/ 32767")
for p, up in rep["ports"].items():
    print("porta", p, "UP" if up else "down")
for f, probs in rep["envfiles"].items():
    print(f, len(probs), "problemas")
print("relatorio -> docs/preflight.json")
sys.exit(0)