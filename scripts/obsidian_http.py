#!/usr/bin/env python3
import json, os, shutil, socket, subprocess, sys, time

cfg = os.path.join(os.environ["APPDATA"], "obsidian", "obsidian.json")
vault = None
if os.path.isfile(cfg):
    d = json.load(open(cfg, encoding="utf-8"))
    vs = list(d.get("vaults", {}).values())
    vs.sort(key=lambda v: v.get("ts", 0), reverse=True)
    if vs:
        vault = vs[0]["path"]
if not vault:
    vault = input("caminho do vault: ").strip().strip('"')

pj = os.path.join(vault, ".obsidian", "plugins", "obsidian-local-rest-api")
dj = os.path.join(pj, "data.json")
if not os.path.isfile(dj):
    print("plugin nao instalado em", pj); sys.exit(1)

subprocess.run(["taskkill", "/IM", "Obsidian.exe", "/F"], capture_output=True)
time.sleep(2)

shutil.copy2(dj, dj + ".bak")
data = json.load(open(dj, encoding="utf-8"))
data["enableInsecureServer"] = True
data["enableSecureServer"] = True
data["insecurePort"] = data.get("insecurePort", 27123)
data["bindingHost"] = "127.0.0.1"
json.dump(data, open(dj, "w", encoding="utf-8"), indent=2)

cl = os.path.join(vault, ".obsidian", "community-plugins.json")
if os.path.isfile(cl):
    ids = json.load(open(cl, encoding="utf-8"))
    if "obsidian-local-rest-api" not in ids:
        ids.append("obsidian-local-rest-api")
        shutil.copy2(cl, cl + ".bak")
        json.dump(ids, open(cl, "w", encoding="utf-8"), indent=2)

subprocess.Popen(["cmd", "/c", "start", "", "obsidian://open"], shell=False)
for _ in range(30):
    time.sleep(2)
    s = socket.socket(); s.settimeout(1)
    ok = s.connect_ex(("127.0.0.1", 27123)) == 0
    s.close()
    if ok:
        print("27123 UP"); sys.exit(0)
print("27123 nao subiu — ver data.json do plugin"); sys.exit(2)