"""Le payload du harnais 08, imprimé en JSON pour `rendu.js`."""
import contextlib
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Importer le harnais rejoue ses constats : leur sortie n'a rien à faire dans le JSON.
with contextlib.redirect_stdout(io.StringIO()):
    from test_payload import Compte  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

print(json.dumps(build_payload(Compte()), default=str))
