import os
from langfuse.callback import CallbackHandler


def get_langfuse_handler(run_name: str = "agent-run"):
    pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
    sk = os.environ.get("LANGFUSE_SECRET_KEY")
    host = os.environ.get("LANGFUSE_HOST", "http://localhost:3000")
    if not pk or not sk:
        return None
    return CallbackHandler(public_key=pk, secret_key=sk, host=host, run_name=run_name)
