class NexusError(Exception):
    """Base class for domain errors; the API layer maps these to HTTP codes."""


class NotFoundError(NexusError):
    pass


class ValidationError(NexusError):
    pass
