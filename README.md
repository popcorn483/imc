# IMC

Private. The pages and code here are encrypted and need the password to open.

To edit (needs the password): `python3 tools/unlock.py . ../imc-src` unpacks the source (add `--history` for the full history), copy `data/` into it to test, make changes, then `python3 ../imc-src/tools/publish.py ../imc-src .` locks it again. Commit and push this folder only.
