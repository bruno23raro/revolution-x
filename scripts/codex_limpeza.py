import os, re, shutil, tomllib

P = os.path.expanduser("~/.codex/config.toml")
txt = open(P, encoding="utf-8").read().splitlines()
shutil.copy2(P, P + ".bak-limpeza")

blocos, cur, buf = [], None, []
for ln in txt:
    s = ln.strip()
    if s.startswith("[") and s.endswith("]"):
        blocos.append((cur, buf)); cur, buf = s, []
    else:
        buf.append(ln)
blocos.append((cur, buf))

topo, tabelas, vistos = [], [], set()
for h, linhas in blocos:
    if h is None:
        chaves = set()
        for l in linhas:
            m = re.match(r"^([A-Za-z_][\w-]*)\s*=", l)
            if m:
                if m.group(1) in chaves:
                    continue
                chaves.add(m.group(1))
            topo.append(l)
    else:
        if h in vistos:
            continue
        vistos.add(h)
        tabelas.append((h, linhas))

# marcadores duplicados e vazios
limpo = []
for l in topo:
    if l.strip() in ("# freellmapi:start", "# freellmapi:end") and limpo and limpo[-1].strip() == l.strip():
        continue
    limpo.append(l)
topo = limpo

if not any(re.match(r"^model_provider\s*=", l) for l in topo):
    topo.insert(0, 'model_provider = "freellmapi"')

final = [l for l in topo if l.strip()] + [""]
for h, linhas in tabelas:
    final.append(h)
    final += [l for l in linhas]
    final.append("")

texto = "\n".join(final).rstrip() + "\n"
try:
    tomllib.loads(texto)
except Exception as e:
    print("AINDA INVALIDO:", e); print("backup em", P + ".bak-limpeza"); raise SystemExit(1)

open(P, "w", encoding="utf-8").write(texto)
print("limpo e validado")
print("servidores:", sorted(k for k in vistos if k.startswith("[mcp_servers.")))