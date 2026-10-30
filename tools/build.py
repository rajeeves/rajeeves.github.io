import html, pathlib, re, shutil, sys
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

parts = {"HISTORY_HTML": hist}
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
print("out/index.html", len(page.encode()), "bytes")
