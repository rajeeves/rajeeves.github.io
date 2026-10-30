import base64, io, pathlib, string, sys
from fontTools import subset
from fontTools.ttLib import TTFont

fonts, content, dest = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
url = (content / "title.txt").read_text("utf-8")
name = (content / "name.txt").read_text("utf-8")
text = url + name + name.lower() + "@" + string.punctuation + string.ascii_letters + string.digits + " "

f = TTFont(str(fonts / "fira-code/files/fira-code-latin-300-normal.woff2"), recalcTimestamp=False)
o = subset.Options(); o.layout_features = ["*"]; o.flavor = "woff2"
s = subset.Subsetter(o); s.populate(text=text); s.subset(f)
b = io.BytesIO(); f.flavor = "woff2"; f.save(b)
dest.write_text("@font-face{font-family:'Fira Code';font-weight:300;font-style:normal;font-display:swap;"
                f"src:url(data:font/woff2;base64,{base64.b64encode(b.getvalue()).decode()}) format('woff2')}}\n")
print("Fira Code 300", len(b.getvalue()) // 1024, "KB")
