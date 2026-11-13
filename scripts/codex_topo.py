import os, re, shutil
P = os.path.expanduser("~/.codex/config.toml")
linhas = open(P, encoding="utf-8").read().splitlines()
shutil.copy2(P, P + ".bak-topo")
topo = [l for l in linhas if not l.strip().startswith("[") and "=" in l and "model_provider" in l]
resto = [l for l in linhas if l not in topo]
novo = ['model_provider = "freellmapi"', 'model = "auto"'] + [l for l in resto if not re.match(r'^model\s*=', l.strip())]
open(P, "w", encoding="utf-8").write("\n".join(novo).rstrip() + "\n")
print("topo normalizado")