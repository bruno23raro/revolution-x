#!/usr/bin/env python3
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "integracoes-inventario.json")
MD = os.path.join(ROOT, "docs", "integracoes-inventario.md")

METH = re.compile(r"export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)")
rows = []

def scan(base, prefix):
    for dirpath, _, files in os.walk(os.path.join(ROOT, base)):
        for f in files:
            if f not in ("route.ts", "page.tsx"):
                continue
            p = os.path.join(dirpath, f)
            rel = os.path.relpath(p, ROOT).replace("\\", "/")
            url = "/" + rel.replace("app/", "").replace("/route.ts", "").replace("/page.tsx", "")
            url = url.replace("(app)", "").replace("//", "/")
            if prefix and not url.startswith(prefix):
                continue
            try:
                txt = open(p, encoding="utf-8", errors="replace").read()
            except Exception:
                continue
            rows.append({
                "file": rel, "url": url, "kind": "page" if f == "page.tsx" else "api",
                "methods": METH.findall(txt),
                "auth": any(k in txt for k in ("getAuth", "requireAdmin", "getAuthenticatedUser")),
                "publico": any(k in txt for k in ("webhook", "callback")),
                "externo": sorted(set(re.findall(r"(graph\.facebook\.com|openbsp|baseUrl)", txt))),
                "envs": sorted(set(re.findall(r"process\.env\.([A-Z0-9_]+)", txt))),
            })

for base, pref in (("app/api/integrations", "/api/integrations"),
                   ("app/api/whatsapp", "/api/whatsapp"),
                   ("app/api/email", "/api/email"),
                   ("app/api/oauth", "/api/oauth"),
                   ("app/integracoes", "/integracoes"),
                   ("app/api/auth", "/api/auth")):
    scan(base, pref)

rows.sort(key=lambda r: (r["kind"], r["url"]))
json.dump(rows, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

with open(MD, "w", encoding="utf-8") as fh:
    fh.write("# Inventario de integracoes\n\n")
    fh.write("| tipo | rota | metodos | auth | publico | externo |\n|---|---|---|---|---|---|\n")
    for r in rows:
        fh.write("| {} | `{}` | {} | {} | {} | {} |\n".format(
            r["kind"], r["url"], ",".join(r["methods"]) or "-",
            "sim" if r["auth"] else "NAO", "sim" if r["publico"] else "-",
            ",".join(r["externo"]) or "-"))

print("rotas:", len(rows), "->", OUT)
print("paginas:", sum(1 for r in rows if r["kind"] == "page"))
print("api:", sum(1 for r in rows if r["kind"] == "api"))
print("sem auth (fora webhook/callback):",
      sum(1 for r in rows if r["kind"] == "api" and not r["auth"] and not r["publico"]))