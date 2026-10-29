"""Tunable constants of the cascade model. Kept in one place so they can be explained in a review."""

FAIL_THRESHOLD = 0.05      # health at or below this => the node is out of service
ISOLATED_CAP = 0.25        # health cap for nodes cut off from their layer's feed
EPSILON = 1e-6             # minimum health drop that counts as propagation
MAX_WAVES = 25             # safety bound on cascade depth
BACKUP_POWER_FACTOR = 0.15 # a backup generator removes 85% of a power dependency
REDIRECT_FACTOR = 0.2      # redirecting service traffic removes 80% of a service dependency
SAFE_MIN, WARNING_MIN = 0.85, 0.5  # status bands: >=0.85 safe, >=0.5 warning, else critical
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
