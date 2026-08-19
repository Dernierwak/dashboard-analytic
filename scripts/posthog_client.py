import atexit
import os

from posthog import Posthog

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

posthog_client = Posthog(
    project_api_key=os.environ.get("POSTHOG_PROJECT_TOKEN", ""),
    host=os.environ.get("POSTHOG_HOST", "https://eu.i.posthog.com"),
    enable_exception_autocapture=True,
)

atexit.register(posthog_client.shutdown)
