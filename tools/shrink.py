"""表示用の軽い JPEG を作る（カード: games/<id>/thumb.jpg, トップ: assets/top.jpg）。
サーバーを立てた状態で:  python tools/shrink.py http://localhost:8000"""
import base64, os, re, subprocess, sys
BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS = [("assets/top.png", "assets/top.jpg", 1882, .82)] + [
    (f"games/{g}/top2.png", f"games/{g}/thumb.jpg", 760, .82) for g in ["link", "cannon", "ringo", "paku", "rhythm", "home", "sagashi", "lab"]]
for src, dst, w, q in JOBS:
    url = f"{BASE}/tools/shrink.html?src=../{src}&w={w}&q={q}"
    html = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--virtual-time-budget=4000", "--dump-dom", url],
                          capture_output=True, text=True, encoding="utf-8").stdout
    m = re.search(r"data:image/jpeg;base64,([A-Za-z0-9+/=]+)", html)
    if not m: print("NG", src); continue
    data = base64.b64decode(m.group(1))
    open(os.path.join(ROOT, dst), "wb").write(data)
    print(f"{dst}: {len(data) // 1024} KB")
