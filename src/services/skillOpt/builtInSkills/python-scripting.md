# Python Scripting

## Core Principles
- Check Python version (`python --version` / `python3 --version`) before using language features. Python 3.10+ features (structural pattern matching) are unavailable in 3.8.
- Inspect existing project structure (`requirements.txt`, `pyproject.toml`, `setup.py`) before adding dependencies.
- Use virtual environments for every project — never install packages globally.

## Virtual Environments
- Create: `python -m venv .venv`. Activate: `source .venv/bin/activate` (Unix) or `.venv\Scripts\activate` (Windows).
- Use `pip install -r requirements.txt` to install dependencies. Pin versions in `requirements.txt`.
- Use `uv` for faster dependency management when available.

## Type Hints
- Add type hints to all function signatures: `def process(items: list[str]) -> dict[str, int]`.
- Use `Optional[T]` or `T | None` for nullable values. Use `TypedDict` for typed dictionaries.
- Run `mypy` or `pyright` for static type checking.

## Error Handling
- Use specific exception types. Never use bare `except:` — it catches `SystemExit` and `KeyboardInterrupt`.
- Use context managers (`with` statement) for all resource handling (files, connections, locks).

## Security
- Never use `eval()`, `exec()`, or `pickle.loads()` on user-supplied data.
- Use `subprocess.run()` with a list of arguments — never `subprocess.run(shell=True)` with user input.
- Use `secrets` module for cryptographic random values — never `random` module.

## Verification Checklist
- [ ] Is Python version confirmed before using language features?
- [ ] Is a virtual environment active?
- [ ] Are all function signatures type-annotated?
- [ ] Is `eval()` and `shell=True` avoided for user-supplied input?
