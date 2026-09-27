"""Run with `python -m scheduler_sdk.runner` or `jobscheduler-python-runner`."""

from scheduler_sdk.protocol import run


def main() -> int:
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
