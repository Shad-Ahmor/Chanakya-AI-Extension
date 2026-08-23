# Django

## Core Principles
- Check the Django version in `requirements.txt` before using features. Django 4.x and 5.x have different behaviors.
- Follow Django's MVT architecture: Model -> View (logic) -> Template (presentation).
- Use Django's ORM for all database access — never raw SQL except for complex performance-critical queries via `raw()` with parameterization.

## Security
- `DEBUG = False` in production — always. A `DEBUG = True` production server exposes stack traces, settings, and installed apps.
- Load `SECRET_KEY` from environment variable — never commit it to version control.
- Use `ALLOWED_HOSTS` to restrict hostnames — never `['*']` in production.
- Use Django's built-in CSRF protection — never disable `CsrfViewMiddleware`.
- Use `User.objects.create_user()` for password hashing — never store raw passwords.

## ORM
- Use `.select_related()` for ForeignKey/OneToOne and `.prefetch_related()` for ManyToMany to eliminate N+1 queries.
- Use `F()` expressions for atomic database-level updates.
- Use `Q()` objects for complex query conditions.

## Forms & Validation
- Use Django Forms or ModelForms for all user input validation.
- Always call `form.is_valid()` before accessing `form.cleaned_data`.
- Use `ModelForm` `clean_*` methods for field-level validation.

## Verification Checklist
- [ ] Is `DEBUG = False` confirmed in production?
- [ ] Is `SECRET_KEY` loaded from environment?
- [ ] Is `ALLOWED_HOSTS` configured — not `['*']`?
- [ ] Is `.select_related()` / `.prefetch_related()` used where N+1 is possible?
- [ ] Is CSRF middleware enabled?
