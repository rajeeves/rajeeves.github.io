import base64, io, pathlib, sys
from fontTools import subset
from fontTools.ttLib import TTFont

fonts, dest = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
UNI = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2010, 0x2028)) + list(range(0x2030, 0x205F))
out = []
for weight, style in ((400, "normal"), (600, "normal"), (400, "italic")):
    f = TTFont(str(fonts / f"ibm-plex-serif/files/ibm-plex-serif-latin-{weight}-{style}.woff2"), recalcTimestamp=False)
    o = subset.Options(); o.layout_features = ["*"]; o.flavor = "woff2"
    s = subset.Subsetter(o); s.populate(unicodes=UNI); s.subset(f)
    b = io.BytesIO(); f.flavor = "woff2"; f.save(b)
    out.append(f"@font-face{{font-family:'IBM Plex Serif';font-weight:{weight};font-style:{style};font-display:swap;"
               f"src:url(data:font/woff2;base64,{base64.b64encode(b.getvalue()).decode()}) format('woff2')}}")
    print("IBM Plex Serif", weight, style, len(b.getvalue()) // 1024, "KB")
dest.write_text("\n".join(out) + "\n")
