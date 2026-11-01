"""Cut IMC's product photos (data/products/*.jpg|png, white background) out cleanly, for use on coloured backgrounds.

  python tools/cutout.py [--all] [--model path/to/isnet-general-use.onnx]

Writes data/products/cut/<name>.png (transparent background, trimmed, about 640px). No AI upscaling: the small
photos are enlarged with a plain Lanczos filter, so the writing on cups and packets stays exactly as IMC's photo
has it (soft rather than invented). The background is found by the ISNet background-removal model (it keeps white
parts of the product, like a cup's rim, and drops the photo's grey shadow), then the edge is tidied: faint haze
dropped and the white fringe taken out of the edge colours. A hand-made mask in data/products/masks/<name>.png
(white = keep) takes away extra parts: the Kids Tray's photo has a popcorn box behind it that isn't part of the tray. Runs in GitHub Actions for new photos
(.github/workflows/cutout-products.yml); photos that already have a cut-out are left alone unless --all."""
import glob, json, os, sys, time, urllib.request
import numpy as np
from PIL import Image, ImageFilter

MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
OUT = "data/products/cut"
args = sys.argv[1:]
model = args[args.index("--model") + 1] if "--model" in args else "isnet-general-use.onnx"
SRC = sorted(f for f in glob.glob("data/products/*.jpg") + glob.glob("data/products/*.png"))
name_of = lambda f: os.path.splitext(os.path.basename(f))[0]
# cut-outs made by hand (data/products/cut/handmade.json, e.g. the combos rebuilt from IMC's large photos) are never redone
try: HAND = set(json.load(open(f"{OUT}/handmade.json")).get("names", []))
except Exception: HAND = set()
todo = [f for f in SRC if name_of(f) not in HAND and ("--all" in args or not os.path.exists(f"{OUT}/{name_of(f)}.png"))]
if "--check" in args:
    print(len(todo)); sys.exit(0)
if not todo:
    print("nothing to do"); sys.exit(0)
import onnxruntime as ort
if not os.path.exists(model):
    urllib.request.urlretrieve(MODEL_URL, model)
so = ort.SessionOptions(); so.enable_cpu_mem_arena = False
sess = ort.InferenceSession(model, so, providers=["CPUExecutionProvider"]); inp = sess.get_inputs()[0].name

def mask(im):
    x = np.asarray(im.convert("RGB").resize((1024, 1024), Image.BICUBIC)).astype("float32") / 255 - 0.5
    y = sess.run(None, {inp: x.transpose(2, 0, 1)[None].astype("float32")})[0][0, 0]
    y = (y - y.min()) / (y.max() - y.min() + 1e-8)
    return np.asarray(Image.fromarray((y * 255).astype("uint8")).resize(im.size, Image.BICUBIC)).astype("float32") / 255

def cut(f):
    src = Image.open(f).convert("RGBA")
    if src.getchannel("A").getextrema()[0] < 250:        # already has a transparent background (e.g. the Candy King cup)
        a = np.asarray(src).astype("float32") / 255
        rgb, alpha = a[..., :3], a[..., 3]
    else:
        k = max(1, round(640 / max(src.size)))
        big = src.convert("RGB").resize((src.width * k, src.height * k), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
        rgb = np.asarray(big).astype("float32") / 255
        m = mask(big)
        alpha = np.clip((m - 0.3) / 0.45, 0, 1); alpha = alpha * alpha * (3 - 2 * alpha)     # drop faint haze/shadow, keep a soft edge
        mk = f"data/products/masks/{name_of(f)}.png"   # a hand-made mask (white = keep), e.g. the Kids Tray without the popcorn box behind it
        if os.path.exists(mk): alpha = alpha * np.asarray(Image.open(mk).convert("L").resize(big.size, Image.BILINEAR)).astype("float32") / 255
        from scipy import ndimage as nd
        alpha = np.where(nd.binary_fill_holes(alpha > 0.5), np.maximum(alpha, 1.0), alpha)   # no see-through gaps inside a product (pale lettering can look like background)
        a8 = Image.fromarray((alpha * 255).astype("uint8")).filter(ImageFilter.MinFilter(3))  # pull the edge in a pixel: no white rim
        alpha = np.asarray(a8).astype("float32") / 255
        # take the white background out of part-see-through edge pixels (colour = (seen - (1 - a) * white) / a)
        ae = np.maximum(alpha, 1e-3)[..., None]
        rgb = np.where(alpha[..., None] > 0.02, np.clip((rgb - (1 - ae)) / ae, 0, 1), rgb)
    # a small separate strip along the bottom (the drinks-logo row on IMC's bundle photos) is left off
    rows = (alpha > 0.1).any(axis=1); H = len(rows); ys = np.where(rows)[0]
    if len(ys):
        top, bot = ys[0], ys[-1]; gap = 0
        for y in range(bot, top + int((bot - top) * 0.62), -1):
            if not rows[y]:
                gap += 1
                if gap >= 6 and (bot - y) < 0.2 * (bot - top): alpha = alpha.copy(); alpha[y:, :] = 0; break
            else:
                gap = 0
    # ...and when it sits level with something else (the two-ticket bundles), any small separate piece low down
    from scipy import ndimage as nd
    lab, n = nd.label(alpha > 0.5)
    if n > 1:
        sizes = nd.sum(alpha > 0.5, lab, range(1, n + 1)); big = sizes.max(); ys = np.where((alpha > 0.5).any(axis=1))[0]; top, bot = ys[0], ys[-1]
        for i, sz in enumerate(sizes, 1):
            if sz < 0.08 * big:
                yy = np.where(lab == i)[0]
                if yy.min() > top + 0.72 * (bot - top): alpha = alpha.copy(); alpha[lab == i] = 0
        alpha = alpha * nd.binary_dilation(alpha > 0.5, iterations=3)   # faint leftovers away from the picture go too
    out = Image.fromarray((np.dstack([rgb, alpha]) * 255).round().astype("uint8"), "RGBA")
    bb = out.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if bb: out = out.crop((max(0, bb[0] - 2), max(0, bb[1] - 2), min(out.width, bb[2] + 2), min(out.height, bb[3] + 2)))
    out.thumbnail((720, 720), Image.LANCZOS)
    return out

os.makedirs(OUT, exist_ok=True); done = []
for f in todo:
    try:
        cut(f).save(f"{OUT}/{name_of(f)}.png", optimize=True); done.append(name_of(f)); print("cut out", name_of(f))
    except Exception as e:
        print("failed", f, e)
json.dump({"run": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "done": done}, open(f"{OUT}/log.json", "w"), indent=1)
