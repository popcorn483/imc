"""Upscale IMC's small product photos (data/products/*.jpg, usually 160px) 4x with Real-ESRGAN.
Writes data/products/hd/<name>.png and a log to data/products/hd/log.json. Runs in GitHub Actions
(.github/workflows/upscale-products.yml). Photos larger than 400px are already sharp enough and are skipped."""
import glob, json, os, sys, time, traceback
from PIL import Image

SRC = sorted(glob.glob("data/products/*.jpg") + glob.glob("data/products/*.png"))
todo = [f for f in SRC if not os.path.exists(f"data/products/hd/{os.path.splitext(os.path.basename(f))[0]}.png")]
log = {"run": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "done": [], "skipped": [], "errors": []}
if "--check" in sys.argv:
    print(len(todo)); sys.exit(0)
try:
    import numpy as np, torch
    from spandrel import ModelLoader
    torch.set_num_threads(os.cpu_count() or 2)
    model = ModelLoader().load_from_file("RealESRGAN_x4plus.pth").eval()
    for f in todo:
        name = os.path.splitext(os.path.basename(f))[0]
        try:
            im = Image.open(f).convert("RGB")
            if max(im.size) > 400:
                log["skipped"].append(name); continue
            x = torch.from_numpy(np.asarray(im).astype("float32") / 255).permute(2, 0, 1)[None]
            with torch.no_grad():
                y = model(x)
            y = (y[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype("uint8")
            out = Image.fromarray(y)
            out.thumbnail((800, 800), Image.LANCZOS)
            out.save(f"data/products/hd/{name}.png", optimize=True)
            log["done"].append({"name": name, "from": list(im.size), "to": list(out.size)})
            print("upscaled", name, im.size, "->", out.size)
        except Exception:
            log["errors"].append({"name": name, "error": traceback.format_exc()[-800:]})
except Exception:
    log["errors"].append({"name": "setup", "error": traceback.format_exc()[-1500:]})
prev = []
try:
    prev = json.load(open("data/products/hd/log.json")).get("history", [])
except Exception:
    pass
log["history"] = (prev + [{"run": log["run"], "done": len(log["done"]), "errors": len(log["errors"])}])[-20:]
json.dump(log, open("data/products/hd/log.json", "w"), indent=1)
print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in log.items()}))
