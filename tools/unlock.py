#!/usr/bin/env python3
"""Open the encrypted source archive in the public repository.

  IMC_PASSWORD=... python3 tools/unlock.py PUBLIC_DIR OUTPUT_DIR
  (asks for the password if IMC_PASSWORD isn't set)

Unpacks the private source into OUTPUT_DIR. Then copy PUBLIC_DIR/data into it to test locally,
make changes, and run tools/publish.py OUTPUT_DIR PUBLIC_DIR to lock and publish them again.
"""
import base64, io, os, sys, tarfile, getpass
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

pub, out = sys.argv[1], sys.argv[2]
history = "--history" in sys.argv  # also rebuild the full git history from .vault/history.bundle.enc.*
pw = os.environ.get("IMC_PASSWORD") or getpass.getpass("Password: ")
salt = base64.b64decode(open(os.path.join(pub, ".vault/salt.txt")).read().strip())
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=600_000).derive(pw.encode("utf-8"))
blob = open(os.path.join(pub, ".vault/source.tar.gz.enc"), "rb").read()
assert blob[:9] == b"IMCVAULT1", "not an IMC vault"
try:
    data = AESGCM(key).decrypt(blob[9:21], blob[21:], None)
except Exception:
    sys.exit("Wrong password.")
os.makedirs(out, exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
    tar.extractall(out, filter="data")
print("Unlocked into", out)
if history:
    parts = sorted(p for p in os.listdir(os.path.join(pub, ".vault")) if p.startswith("history.bundle.enc."))
    hb = b"".join(open(os.path.join(pub, ".vault", p), "rb").read() for p in parts)
    open(os.path.join(out, "history.bundle"), "wb").write(AESGCM(key).decrypt(hb[9:21], hb[21:], None))
    print("Full history saved as", os.path.join(out, "history.bundle"), "(git clone history.bundle to use it)")
