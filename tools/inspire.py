#!/usr/bin/env python3
import json, pathlib, sys, time, urllib.parse, urllib.request

API = "https://inspirehep.net/api/literature"
FIELDS = ",".join(["titles", "authors.full_name", "arxiv_eprints", "dois", "publication_info",
                   "earliest_date", "document_type", "control_number"])

def get(url):
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"Accept": "application/json",
                                                   "User-Agent": "personal-site-build (rajeev.erramil.li)"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(6); continue
            raise
    raise RuntimeError("INSPIRE kept returning 429")

def main():
    author = sys.argv[1]
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else ".")
    out.mkdir(parents=True, exist_ok=True)
    q = urllib.parse.urlencode({"q": f"a {author}", "sort": "mostrecent", "size": 250, "fields": FIELDS})
    url, pages, hits = f"{API}?{q}", [], []
    while url:
        raw = get(url); pages.append(raw.decode("utf-8"))
        data = json.loads(raw)
        hits += data["hits"]["hits"]
        url = data.get("links", {}).get("next")
        time.sleep(0.5)
    (out / "inspire-raw.json").write_text("[" + ",\n".join(pages) + "]\n", encoding="utf-8")

    papers = []
    for h in hits:
        m = h["metadata"]
        pub = (m.get("publication_info") or [{}])[0]
        papers.append({
            "inspire_id": m.get("control_number"),
            "title": (m.get("titles") or [{}])[0].get("title"),
            "authors": [a.get("full_name") for a in m.get("authors", [])],
            "arxiv": (m.get("arxiv_eprints") or [{}])[0].get("value"),
            "doi": (m.get("dois") or [{}])[0].get("value"),
            "journal": {k: pub.get(k) for k in ("journal_title", "journal_volume", "year", "artid", "page_start") if pub.get(k)},
            "date": m.get("earliest_date"),
            "type": m.get("document_type"),
        })
    (out / "papers.json").write_text(json.dumps(papers, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(papers)} records for {author} -> {out / 'papers.json'}")
    for p in papers[:5]:
        print(" ", p["date"], p["arxiv"], (p["type"] or [""])[0])

if __name__ == "__main__":
    main()
