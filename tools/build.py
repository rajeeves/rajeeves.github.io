import html, json, pathlib, re, shutil, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import content_lib

root = pathlib.Path(sys.argv[1])
content, src, build, out = root / "content", root / "src", root / "build", root / "out"
out.mkdir(exist_ok=True)

files = {"TITLE": "title.txt", "NAME": "name.txt", "NOTICE": "notice.txt", "BIO1": "bio1.txt", "BIO2": "bio2.txt",
         "SELECTED_HEADING": "selected-heading.txt", "PAPERS_HEADING": "papers-heading.txt",
         "HISTORY_HEADING": "history-heading.txt", "SOFTWARE_HEADING": "software-heading.txt"}
text = {k: html.escape((content / f).read_text("utf-8"), quote=True) for k, f in files.items()}

hist = "".join(f'<li class="hrow"><span class="hdates">{html.escape(d)}</span><span class="hbody">'
               f'<span class="hinst">{html.escape(i)}</span>'
               + "".join(f'<span class="hrole">{html.escape(r)}</span>' for r in roles)
               + '</span></li>\n' for d, i, *roles in content_lib.history(content))

links = content_lib.links(content)
links_html = '<span class="sep"> · </span>'.join(
    f'<a href="{html.escape(u, quote=True)}" rel="me">{html.escape(t)}</a>' for t, u in links)
site = "https:" + (content / "title.txt").read_text("utf-8").strip()
person = {"@context": "https://schema.org", "@type": "Person", "name": (content / "name.txt").read_text("utf-8").strip(),
          "url": site, "sameAs": [u for _, u in links]}
jsonld = json.dumps(person, ensure_ascii=False, indent=1).replace("</", "<\\/")

cv = content / "cv.pdf"
cv_html = (f'<p class="cvlink"><a href="erramilli-cv.pdf">{html.escape((content / "cv-label.txt").read_text("utf-8"))}</a></p>'
           if cv.exists() else "")

parts = {"HISTORY_HTML": hist, "CV_HTML": cv_html, "LINKS_HTML": links_html, "PERSON_JSONLD": jsonld, "CANONICAL": html.escape(site, quote=True)}
for k, f in [("PALETTES_CSS", "palettes.css"), ("FONTS_CSS", "fonts.css"), ("BODYFONTS_CSS", "bodyfonts.css"),
             ("PAPERS_HTML", "papers.html"), ("SELECTED_HTML", "selected.html"), ("SOFTWARE_HTML", "software.html")]:
    parts[k] = (build / f).read_text("utf-8")

page = (src / "index.html").read_text("utf-8")
for k, v in {**parts, **text}.items():
    page = page.replace("{{" + k + "}}", v)
left = re.findall(r"\{\{[A-Z_]+\}\}", page)
if left:
    raise SystemExit(f"unfilled: {left}")
(out / "index.html").write_text(page, "utf-8")

for d in ("js", "ising"):
    shutil.rmtree(out / d, ignore_errors=True)
    shutil.copytree(src / d, out / d)
if cv.exists():
    shutil.copyfile(cv, out / "erramilli-cv.pdf")
print("out/index.html", len(page.encode()), "bytes")
