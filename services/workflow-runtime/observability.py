import os

try:
    from langfuse.callback import CallbackHandler
    _langfuse_ok = True
except (ImportError, ModuleNotFoundError):
    _langfuse_ok = False


def get_langfuse_handler(run_name: str = "agent-run"):
    if not _langfuse_ok:
        return None
    pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
    sk = os.environ.get("LANGFUSE_SECRET_KEY")
    host = os.environ.get("LANGFUSE_HOST", "http://localhost:3001")
    if not pk or not sk:
        return None
    return CallbackHandler(public_key=pk, secret_key=sk, host=host, run_name=run_name)
