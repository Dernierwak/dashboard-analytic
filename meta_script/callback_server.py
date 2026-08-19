import atexit
import os

from flask import Flask, request, redirect
from posthog import Posthog

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)

posthog_client = Posthog(
    project_api_key=os.environ.get("POSTHOG_PROJECT_TOKEN", ""),
    host=os.environ.get("POSTHOG_HOST", "https://eu.i.posthog.com"),
    enable_exception_autocapture=True,
)
atexit.register(posthog_client.shutdown)


@app.route("/callback")
def callback():
    code = request.args.get("code")
    posthog_client.capture(
        distinct_id="anonymous",
        event="meta_oauth_callback_received",
        properties={"has_code": bool(code)},
    )
    return redirect(f"http://localhost:8502?code={code}")


if __name__ == "__main__":
    app.run(port=5000, ssl_context="adhoc")
