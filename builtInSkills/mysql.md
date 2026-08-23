# MySQL

## Core Principles
- Inspect the existing schema with `SHOW CREATE TABLE tablename`, `DESCRIBE tablename`, and `SHOW INDEX FROM tablename` before writing queries.
- Never perform destructive operations without verification — always run equivalent `SELECT` first, wrap destructive DML in a transaction, and confirm the target database.
- Parameterized queries are non-negotiable. SQL injection is the leading cause of data breaches.

## Schema Design
- Use `InnoDB` for all tables — supports transactions, foreign keys, row-level locking.
- Use `utf8mb4` (NOT `utf8`) with `utf8mb4_unicode_ci`. MySQL's `utf8` is 3-byte and does not support emoji.
- Use `DECIMAL(p, s)` for monetary values — never `FLOAT` or `DOUBLE` (floating-point precision errors).
- Use `DATETIME` for timezone-agnostic timestamps. `TIMESTAMP` converts to session timezone.
- Use `NOT NULL` by default with explicit defaults. Nullable columns complicate JOINs and index usage.

## Indexes
- Inspect `SHOW INDEX FROM tablename` before creating new indexes — never add duplicate indexes.
- ESR rule for compound indexes: Equality filters first → Sort fields second → Range filters last.
- Index-defeating patterns to avoid: function wrapping (`DATE(col)`), leading wildcard LIKE (`%suffix`), implicit type conversion, arithmetic on columns.
- Covering indexes: index contains all columns the query references — answers query entirely from the index.

## Transactions
- Use `START TRANSACTION` / `COMMIT` for multi-statement operations.
- `ROLLBACK` in catch blocks if any statement fails.
- Short transactions — long ones hold row locks and increase deadlock probability.
- Deadlocks (error `1213`): implement retry logic with exponential backoff.

## EXPLAIN
- Run `EXPLAIN SELECT ...` before deploying any query against large tables.
- `type` column: `const` > `eq_ref` > `ref` > `range` > `index` > `ALL`. `ALL` = full table scan — red flag.
- `key`: `NULL` means no index used.
- `Extra`: `Using index` (covering — good), `Using filesort` (needs index for sort), `Using temporary` (needs optimization).
- Run `SHOW WARNINGS` after `EXPLAIN` for implicit type conversion warnings.

## Foreign Keys
- Use `RESTRICT` as the default `ON DELETE` behavior — prevents parent row deletion if child rows exist.
- `CASCADE` auto-deletes child rows — only use when this is the explicit business requirement.
- Named constraints: `CONSTRAINT fk_orders_user_id FOREIGN KEY ...`.

## Views
- Use `ALGORITHM = MERGE` (default when possible) — inlines view into calling query, preserving index access.
- `ALGORITHM = TEMPTABLE` materializes to a temp table — loses index access. Avoid.

## Security & SQL Injection Prevention
- Prepared statements always:
```php
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
```
- Configure PDO: `ERRMODE_EXCEPTION`, `FETCH_ASSOC`, `EMULATE_PREPARES => false`.
- Application user: only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on relevant tables. Never `root`.
- Bind MySQL to `localhost` or private interface — never expose to public internet.
- Enable TLS for client connections: `REQUIRE SSL` on user accounts.

## Migrations
- Every schema change is a versioned migration file in source control.
- `ALTER TABLE` on large tables may rebuild the table. Use `pt-online-schema-change` or `gh-ost` for large production tables.
- Test migrations on production-equivalent data volume before applying to production.

## Backups
- `mysqldump --single-transaction --routines --triggers` for consistent InnoDB backups without locking.
- Enable binary logging (`log_bin`) for point-in-time recovery.
- Test restoring backups to a non-production environment regularly.

## Verification Checklist
- [ ] Has `SHOW CREATE TABLE` been inspected before writing queries or making schema changes?
- [ ] Is the target database confirmed before executing any destructive statement?
- [ ] Has a `SELECT` been run to verify affected rows before `UPDATE` or `DELETE`?
- [ ] Are destructive operations wrapped in `START TRANSACTION` with `ROLLBACK` fallback?
- [ ] Has `EXPLAIN` been reviewed for all new queries against large tables?
- [ ] Are all tables using `InnoDB` and `utf8mb4` charset?
- [ ] Are all user-supplied values parameterized — never concatenated?
- [ ] Is the application using a dedicated least-privilege MySQL user — not root?
