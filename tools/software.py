#!/usr/bin/env python3
import html, json, pathlib, re, sys, urllib.parse, urllib.request

def parse(root):
    rows = []
    for n, line in enumerate((root / "content/software.txt").read_text("utf-8").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"): continue
        url, *rest = [p.strip() for p in line.split(" | ")]
        note, papers, lang = None, [], None
        for part in rest:
            if part and all(re.fullmatch(r"\d{4}\.\d{4,5}", t) for t in part.split()): papers += part.split()
            elif part.startswith("language:"): lang = part[len("language:"):].strip()
            elif part: note = part
        u = urllib.parse.urlparse(url)
        if u.scheme != "https" or u.netloc not in ("github.com", "gitlab.com"):
            raise SystemExit(f"software.txt line {n}: expected a https://github.com/... or https://gitlab.com/... URL")
        known = {p["arxiv"] for p in json.loads((root / "data/papers.json").read_text("utf-8"))}
        missing = [a for a in papers if a not in known]
        if missing: raise SystemExit(f"software.txt line {n}: {missing} not in your INSPIRE papers")
        rows.append({"url": url, "host": u.netloc, "path": u.path.strip("/"), "note": note, "papers": papers, "language_override": lang})
    return rows

def get(url, tries=3):
    import time
    for k in range(tries):
        req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "personal-site-build (rajeev.erramil.li)"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tries - 1: raise
            time.sleep(min(60, int(e.headers.get("Retry-After") or 10 * (k + 1))))

def fetch(r):
    if r["host"] == "github.com":
        d = get("https://api.github.com/repos/" + r["path"])
        return {"name": d.get("name"), "language": d.get("language"), "web_url": d.get("html_url")}
    pid = urllib.parse.quote(r["path"], safe="")
    d = get(f"https://gitlab.com/api/v4/projects/{pid}")
    langs = get(f"https://gitlab.com/api/v4/projects/{pid}/languages") or {}
    return {"name": d.get("name"), "language": max(langs, key=langs.get) if langs else None, "web_url": d.get("web_url")}

def main():
    root = pathlib.Path(sys.argv[1]); offline = "--offline" in sys.argv
    rows = parse(root)
    prev_file = root / "data/software.json"
    prev = {r["url"]: r for r in json.loads(prev_file.read_text("utf-8"))} if prev_file.exists() else {}
    for r in rows:
        r.update({"name": None, "language": None, "web_url": None, "fetched": False})
        if offline:
            old = prev.get(r["url"])
            if old and old.get("fetched"):
                r.update({k: old[k] for k in ("name", "language", "web_url")}); r["fetched"] = True
        else:
            try: r.update(fetch(r)); r["fetched"] = True
            except Exception as e:
                print(f"  {r['path']}: not fetched ({type(e).__name__})")
                old = prev.get(r["url"])
                if old and old.get("fetched"):
                    r.update({k: old[k] for k in ("name", "language", "web_url")}); r["fetched"] = True
                    print("    using the previous fetch"); continue
    for r in rows:
        if r["language_override"]: r["language"] = r["language_override"]
    (root / "data/software.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", "utf-8")
    e = lambda s: html.escape(s, quote=True)
    out = []
    for r in rows:
        lang = f'<span class="swlang">{e(r["language"])}</span>' if r["language"] else '<span class="swlang"></span>'
        name = e(r["name"] or r["path"].split("/")[-1])
        note = f'<div class="swnote">{e(r["note"])}</div>' if r["note"] else ""
        out.append(f'<li class="paper">{lang}<div class="pbody"><a class="ptitle" href="{e(r["web_url"] or r["url"])}">{name}</a>'
                   f'{note}<div class="pref"><span>{e(r["host"])}</span><span class="sep">/</span><span>{e(r["path"])}</span>'
                   + "".join(f'<span class="sep"> · </span><a class="ax" href="https://arxiv.org/abs/{e(a)}">{e(a)}</a>' for a in r["papers"])
                   + '</div></div></li>')
    (root / "build/software.html").write_text("\n".join(out) + "\n", "utf-8")
    print(len(rows), "repos;", sum(r["fetched"] for r in rows), "fetched")

if __name__ == "__main__":
    main()
