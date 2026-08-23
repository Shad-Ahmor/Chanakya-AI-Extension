# Flask

## Core Principles
- Check the Flask version in `requirements.txt` or `pyproject.toml` before using version-specific features (Flask 2.x vs 3.x).
- Use the application factory pattern (`create_app()`) — never use a global `app` instance.
- Never run Flask's development server in production (`app.run()`) — use Gunicorn or uWSGI.

## Application Structure
- Use Blueprints to organize routes by feature area.
- Use `Flask-SQLAlchemy` for database access. Use `Flask-Migrate` (Alembic) for migrations.
- Store configuration in a `Config` class, not scattered inline in the app.

## Security
- Set `SECRET_KEY` from environment variable — never hardcode. Use `secrets.token_hex(32)` to generate.
- Use `Flask-WTF` for CSRF protection on form-based routes.
- Use parameterized SQLAlchemy queries — never string concatenation in raw SQL.
- Set secure cookie flags: `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SECURE=True`, `SESSION_COOKIE_SAMESITE='Strict'`.

## Error Handling
- Register error handlers with `@app.errorhandler(404)` etc. — never let unhandled exceptions expose stack traces.
- Use `abort()` for HTTP error responses. Return JSON error responses for API endpoints.

## Verification Checklist
- [ ] Is the application factory pattern used?
- [ ] Is Flask's dev server never used in production?
- [ ] Is `SECRET_KEY` loaded from environment — not hardcoded?
- [ ] Are all database queries parameterized?
- [ ] Are CSRF protections enabled for form routes?
