#!/usr/bin/env python3
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "docs", "public-apis-index.json")
if not os.path.isfile(IDX):
    print("rode primeiro: python scripts\\api_index.py"); sys.exit(1)

p = argparse.ArgumentParser()
p.add_argument("query", nargs="?", default="")
p.add_argument("--category")
p.add_argument("--no-auth", action="store_true")
p.add_argument("--https-only", action="store_true")
p.add_argument("--cors", action="store_true")
p.add_argument("--mcp", action="store_true")
p.add_argument("--limit", type=int, default=15)
a = p.parse_args()

d = json.load(open(IDX, encoding="utf-8"))
rows = d["mcp"] if a.mcp else d["apis"]
if a.query:
    rx = re.compile(a.query, re.I)
    rows = [r for r in rows if rx.search(r["name"] + " " + r["desc"])]
if a.category:
    rows = [r for r in rows if r.get("category", "").lower() == a.category.lower()]
if a.no_auth:
    rows = [r for r in rows if r["auth"].lower() in ("no", "user-agent", "")]
if a.https_only:
    rows = [r for r in rows if r.get("https")]
if a.cors:
    rows = [r for r in rows if r.get("cors")]

print(len(rows), "resultado(s)")
for r in rows[: a.limit]:
    if a.mcp:
        print("-", r["name"], "|", r["auth"], "|", r["transport"], "|", r["desc"][:120])
    else:
        print("-", r["name"], "|", r["category"], "| auth:", r["auth"],
              "| https:", r["https"], "| cors:", r["cors"])
        print("   ", r["desc"][:160])