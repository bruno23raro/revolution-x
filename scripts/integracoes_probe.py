#!/usr/bin/env python3
import http.cookiejar, json, os, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://127.0.0.1:3000"
EMAIL = os.environ.get("RX_EMAIL", "admin@revx.local")
PWD = os.environ.get("RX_PWD", "")
TS = time.strftime("%Y%m%d_%H%M%S")
OUT = os.path.join(ROOT, "docs", "execucao", "integracoes-" + TS + ".txt")

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def req(method, url, body=None, timeout=20):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + url, method=method, data=data,
                               headers={"Content-Type": "application/json"} if body else {})
    t = time.time()
    try:
        with op.open(r, timeout=timeout) as resp:
            return resp.status, int((time.time() - t) * 1000), resp.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, int((time.time() - t) * 1000), e.read(300).decode("utf-8", "replace")
    except Exception as e:
        return 0, int((time.time() - t) * 1000), type(e).__name__ + ": " + str(e)[:160]

lines, falhas = [], 0
def log(s):
    print(s); lines.append(s)

st, ms, body = req("POST", "/api/auth/login", {"email": EMAIL, "password": PWD})
log("LOGIN %s %sms cookies=%d" % (st, ms, len(jar)))
if st != 200:
    log("corpo: " + body)
    log("ABORTADO: sem sessao")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(lines))
    sys.exit(1)

inv = json.load(open(os.path.join(ROOT, "docs", "integracoes-inventario.json"), encoding="utf-8"))
for r in inv:
    if r["kind"] == "page":
        st, ms, body = req("GET", r["url"])
        mark = "OK" if st == 200 else "FALHA"
    else:
        st, ms, body = req("GET", r["url"])
        if st == 405:
            mark = "POST-ONLY"
        elif st in (200, 401, 403):
            mark = "OK" if st == 200 else "AUTH"
        else:
            mark = "FALHA"
    if mark == "FALHA":
        falhas += 1
    log("%-9s %-3s %5sms %-45s %s" % (mark, st, ms, r["url"], body[:90].replace("\n", " ")))
    time.sleep(0.15)

log("")
log("TOTAL %d | FALHAS %d" % (len(inv), falhas))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(lines))
print("log ->", OUT)
sys.exit(0 if falhas == 0 else 2)