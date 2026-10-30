import pathlib


def history(content_dir):
    f = pathlib.Path(content_dir) / "history.txt"
    if not f.exists():
        return []
    rows = []
    for n, line in enumerate(f.read_text("utf-8").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        parts = [p.strip() for p in line.split(" | ")]
        if len(parts) < 3 or not all(parts):
            raise SystemExit(f"history.txt line {n}: expected 'dates | institution | role [| ...]', got {line!r}")
        rows.append(parts)
    return rows


def links(content_dir):
    f = pathlib.Path(content_dir) / "links.txt"
    if not f.exists():
        return []
    rows = []
    for n, line in enumerate(f.read_text("utf-8").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        parts = [p.strip() for p in line.split(" | ")]
        if len(parts) != 2 or not all(parts) or not parts[1].startswith("https://"):
            raise SystemExit(f"links.txt line {n}: expected 'label | https://...', got {line!r}")
        rows.append(parts)
    return rows
