import os, re, shutil, tomllib

P = os.path.expanduser("~/.codex/config.toml")
txt = open(P, encoding="utf-8").read().splitlines()
shutil.copy2(P, P + ".bak-mcp")

blocos, cur, buf = [], None, []
for ln in txt:
    s = ln.strip()
    if s.startswith("[") and s.endswith("]"):
        blocos.append((cur, buf)); cur, buf = s, []
    else:
        buf.append(ln)
blocos.append((cur, buf))

HDR = re.compile(r"^\[mcp_servers\.([A-Za-z0-9_.-]+)\]$")
removidas, desativados = 0, []

for i, (h, linhas) in enumerate(blocos):
    if not h or not HDR.match(h):
        continue
    novas = []
    for l in linhas:
        if re.match(r"^\s*(transport|type)\s*=", l):
            removidas += 1
            continue
        novas.append(l)
    blocos[i] = (h, novas)

def corpo(h):
    for hh, ls in blocos:
        if hh == h:
            return "\n".join(ls)
    return ""

def valido(nome):
    h = "[mcp_servers.%s]" % nome
    c = corpo(h)
    return bool(re.search(r"^\s*command\s*=", c, re.M)) or bool(re.search(r"^\s*url\s*=", c, re.M))

saida = []
for h, linhas in blocos:
    if h and HDR.match(h):
        nome = HDR.match(h).group(1)
        if "." not in nome and not valido(nome):
            desativados.append(nome)
            saida.append("# DESATIVADO pelo Codex (sem command nem url): " + h)
            saida += ["# " + l for l in linhas]
            continue
    saida.append(h if h else "")
    saida += linhas

texto = "\n".join(l for l in saida if l is not None).rstrip() + "\n"
texto = re.sub(r"\n{3,}", "\n\n", texto)
try:
    tomllib.loads(texto)
except Exception as e:
    print("INVALIDO:", e); raise SystemExit(1)

open(P, "w", encoding="utf-8").write(texto)
print("chaves transport/type removidas:", removidas)
print("servidores desativados:", desativados or "nenhum")