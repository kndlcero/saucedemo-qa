"""Print one line per failing test (with the first lines of its error) from a
Playwright JSON report.  Usage: python scripts/summarize-failures.py results.json"""
import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")

data = json.load(open(sys.argv[1], encoding="utf-8"))


def walk(suite, path):
    for spec in suite.get("specs", []):
        for t in spec["tests"]:
            r = t["results"][-1]
            if r["status"] != "passed":
                msg = re.sub(r"\x1b\[[0-9;]*m", "", (r.get("error") or {}).get("message", ""))
                msg = " / ".join(l.strip() for l in msg.strip().split("\n")[:4])
                print(f"FAIL {path} > {spec['title']}: {msg[:330]}")
    for child in suite.get("suites", []):
        walk(child, f"{path} > {child['title']}")


for s in data["suites"]:
    walk(s, s["title"])
print(data["stats"])
