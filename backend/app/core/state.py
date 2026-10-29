"""Process-wide workspace. FastAPI runs sync endpoints in a thread pool, so access is serialised with a lock."""
import threading

from ..services.workspace import Workspace

workspace = Workspace()
lock = threading.RLock()
