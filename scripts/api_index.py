#!/usr/bin/env python3
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "vendor", "public-apis", "README.md")
OUT = os.path.join(ROOT, "docs", "public-apis-index.json")

if not os.path.isfile(SRC):
    print("README nao encontrado:", SRC); sys.exit(1)

ROW = re.compile(r"^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$")
SKIP_FIRST = {"api", "name", "---", ":---"}

apis, mcps = [], []
cat, mode = None, "skip"

with open(SRC, encoding="utf-8", errors="replace") as fh:
    for raw in fh:
        line = raw.rstrip("\n")
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            title = line[level:].strip()
            low = title.lower()
            if level == 2 and low == "index":
                cat, mode = None, "skip"
            elif "mcp" in low:
                cat, mode = "MCP Servers", "mcp"
            elif 2 <= level <= 4 and title:
                cat, mode = title, "apis"
            continue
        if mode == "skip" or not line.startswith("|"):
            continue
        m = ROW.match(line)
        if not m:
            continue
        name, desc, auth, https, cors = (c.strip() for c in m.groups())
        if name.lower() in SKIP_FIRST or set(name) <= set("-: "):
            continue
        name = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", name)
        if mode == "mcp":
            mcps.append({"name": name, "desc": desc, "auth": auth, "transport": https, "install": cors})
        else:
            apis.append({"name": name, "desc": desc, "auth": auth,
                         "https": https.lower().startswith("y"), "cors": cors.lower().startswith("y"),
                         "category": cat})

data = {"source": "public-apis/public-apis", "count_apis": len(apis),
        "count_mcp": len(mcps), "apis": apis, "mcp": mcps}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=1)

cats = {}
for a in apis:
    cats[a["category"]] = cats.get(a["category"], 0) + 1
print("indexado:", len(apis), "APIs /", len(mcps), "MCP")
print("categorias:", len(cats))
for c, n in sorted(cats.items(), key=lambda kv: -kv[1])[:10]:
    print("  ", n, c)