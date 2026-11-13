import os, re, shutil, tomllib
P = os.path.expanduser("~/.codex/config.toml")
txt = open(P, encoding="utf-8").read().splitlines()
shutil.copy2(P, P + ".bak-hooks")
saida, dentro = [], False
for l in txt:
    s = l.strip()
    if s.startswith("[") and s.endswith("]"):
        dentro = s == "[hooks]" or s.startswith("[hooks.")
        if dentro:
            saida.append("# hooks desativado (sem command): " + l); continue
    if dentro and s and not s.startswith("#"):
        saida.append("# " + l); continue
    saida.append(l)
texto = re.sub(r"\n{3,}", "\n\n", "\n".join(saida).rstrip()) + "\n"
tomllib.loads(texto)
open(P, "w", encoding="utf-8").write(texto)
print("hooks comentado")