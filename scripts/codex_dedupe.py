import os, re, shutil, sys

P = os.path.expanduser("~/.codex/config.toml")
ALVOS = ("supabase", "github", "vercel", "dbhub", "playwright", "filesystem")
HDR = re.compile(r"^\[mcp_servers\.([A-Za-z0-9_-]+)\]")

if not os.path.isfile(P):
    print("sem config"); sys.exit(1)

shutil.copy2(P, P + ".bak")
linhas = open(P, encoding="utf-8", errors="replace").read().splitlines()

saida, dentro, vistos, removidos = [], False, set(), 0
for ln in linhas:
    m = HDR.match(ln.strip())
    if m:
        dentro = m.group(1) in ALVOS
        if dentro:
            if m.group(1) in vistos:
                removidos += 1
            vistos.add(m.group(1))
        saida.append(ln)
        continue
    if ln.strip().startswith("[") and not ln.strip().startswith("[mcp_servers."):
        dentro = False
    if dentro and re.match(r"^(url|command|args|env|bearer_token_env_var)\s*=", ln.strip()):
        if ln.strip() in [s.strip() for s in saida[-12:]]:
            removidos += 1
            continue
    saida.append(ln)

# remove blocos repetidos por completo
final, dentro, ja = [], False, set()
for ln in saida:
    m = HDR.match(ln.strip())
    if m:
        nome = m.group(1)
        if nome in ALVOS and nome in ja:
            dentro = True
            continue
        ja.add(nome)
        dentro = False
        final.append(ln)
        continue
    if ln.strip().startswith("[") and not ln.strip().startswith("[mcp_servers."):
        dentro = False
    if not dentro:
        final.append(ln)

# remove duplicatas de chaves de topo
topo, corpo = [], []
for ln in final:
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*=", ln):
        chave = ln.split("=", 1)[0].strip()
        if chave in topo:
            continue
        topo.append(chave)
    corpo.append(ln)

open(P, "w", encoding="utf-8").write("\n".join(corpo).rstrip() + "\n")
print("blocos ajustados:", removidos)
print("servidores restantes:", sorted(set(HDR.match(l.strip()).group(1) for l in corpo if HDR.match(l.strip()))))