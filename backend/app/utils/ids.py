import itertools

_counter = itertools.count(1)


def new_id(prefix: str) -> str:
    return f"{prefix}-{next(_counter)}"
