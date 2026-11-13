import os, shutil
P = os.path.expanduser("~/.codex/config.toml")
os.makedirs(os.path.dirname(P), exist_ok=True)
txt = open(P, encoding="utf-8").read() if os.path.isfile(P) else ""
if os.path.isfile(P): shutil.copy2(P, P + ".bak")
add = []
if "approval_policy" not in txt: add.append('approval_policy = "never"')
if "sandbox_mode" not in txt: add.append('sandbox_mode = "danger-full-access"')
if add:
    open(P, "a", encoding="utf-8").write("\n" + "\n".join(add) + "\n")
    print("codex: politica aplicada")
else: print("codex: ja aplicada")