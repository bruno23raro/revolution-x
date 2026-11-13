import json, os, shutil
ALLOW = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch",
         "Task", "TodoWrite", "NotebookEdit", "mcp__*"]
def patch(p):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if os.path.isfile(p):
        shutil.copy2(p, p + ".bak")
        try: d = json.load(open(p, encoding="utf-8"))
        except Exception: d = {}
    else: d = {}
    d["permissions"] = {"defaultMode": "bypassPermissions", "allow": ALLOW}
    d["enableAllProjectMcpServers"] = True
    json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("patch:", p)
patch(os.path.join(".claude", "settings.local.json"))
patch(os.path.join(os.path.expanduser("~"), ".claude", "settings.json"))