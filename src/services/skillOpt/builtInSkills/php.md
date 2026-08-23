# PHP

## Core Principles
- Check `composer.json` for the `require.php` version constraint before using any language feature. Never use PHP 8.0+ features in a PHP 7.4 project.
- Add `declare(strict_types=1);` as the first statement in every PHP file. Without it, PHP silently coerces types.
- Never trust external input. All data from `$_GET`, `$_POST`, `$_COOKIE`, `$_FILES`, `$_SERVER`, and API responses is untrusted.

## PHP Version Feature Map
- PHP 7.4: Typed properties, arrow functions, `??=`.
- PHP 8.0: Named arguments, `match` expressions, nullsafe operator `?->`, union types, constructor property promotion.
- PHP 8.1: Enums, readonly properties, fibers, intersection types, `never` return type.
- PHP 8.2: Readonly classes, DNF types, `true`/`false`/`null` standalone types.
- PHP 8.3: Typed class constants, `json_validate()`, `#[\Override]` attribute.

## Types
- Declare parameter types, return types, and property types for all code. Never omit on public methods.
- Use `?Type` for values that can legitimately be `null`. Never return `null` from a non-nullable declared function.
- Use `void` for methods that return nothing. Use `never` for functions that always throw or call `exit()`.

## Classes & OOP
- Use constructor property promotion (PHP 8.0+) to eliminate boilerplate.
- Mark properties `readonly` when they must not change after construction.
- Use `final` on classes and methods that must not be extended/overridden.
- Type-hint to interfaces, not concrete implementations.

## Composer
- All dependencies must be declared in `composer.json`. Never `require` from `vendor/` directly.
- Commit `composer.lock`. Use `composer install` (not `composer update`) in production.
- Dev-only packages use `--dev` flag and must not be installed in production (`composer install --no-dev`).

## Exceptions
- Create domain-specific exception classes extending `\RuntimeException` or `\LogicException`.
- Never catch `\Exception` everywhere — catch the most specific type possible.
- Never swallow exceptions with an empty `catch` block. Always log, rethrow, or convert.

## PDO & Database
- Use PDO for all database access. Always use prepared statements with bound parameters:
```php
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email');
$stmt->execute(['email' => $email]);
```
- Configure PDO: `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES => false`.
- Wrap multi-statement operations in explicit PDO transactions with rollback in catch.

## Security
- Password hashing: `password_hash($password, PASSWORD_BCRYPT)` or `PASSWORD_ARGON2ID`. Never `md5()` or `sha1()`.
- XSS: `htmlspecialchars($string, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` for all HTML output.
- SQL injection: Prepared statements only — no exceptions.
- CSRF: Implement tokens for all state-changing form submissions.
- Production: `display_errors = Off`, `log_errors = On`.

## File Uploads
- Never use client-supplied filename directly. Always generate a safe server-side filename.
- Validate MIME type server-side using `finfo_file()` — not file extension or client MIME type.
- Store uploaded files outside the document root. Serve through a PHP controller that validates authorization.
- Always use `move_uploaded_file()` — not `rename()` or `copy()`.

## Logging
- Use PSR-3 compliant logger (`monolog/monolog`). Never `error_log()` or `var_dump()` in production.
- Use correct log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL.
- Never log passwords, API keys, session tokens, or PII.

## Performance
- Ensure `opcache.enable=1` in `php.ini` on all production servers.
- Use `mb_*` string functions for multibyte (UTF-8) strings.

## Verification Checklist
- [ ] Is `declare(strict_types=1)` present at the top of every PHP file?
- [ ] Is PHP version verified in `composer.json` before using language features?
- [ ] Are all database queries using PDO prepared statements?
- [ ] Is all user output escaped with `htmlspecialchars()` before rendering in HTML?
- [ ] Are passwords stored with `password_hash()` using `PASSWORD_BCRYPT` or `PASSWORD_ARGON2ID`?
- [ ] Is `display_errors = Off` configured in production?
- [ ] Are uploaded files validated by MIME type and stored outside the document root?
- [ ] Is `composer.lock` committed and `composer install --no-dev` used in production?
