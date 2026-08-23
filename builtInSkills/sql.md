# SQL

## Core Principles
- Never generate destructive SQL (`DELETE`, `UPDATE`, `TRUNCATE`, `DROP`) without understanding the target data. Always run a `SELECT` with the same `WHERE` clause first.
- Prefer parameterized queries over string concatenation. SQL injection is one of the most critical and pervasive security vulnerabilities.
- Inspect existing schema (`DESCRIBE table`, `SHOW CREATE TABLE`, `\d tablename`) and indexes before writing queries.

## SELECT
- Never use `SELECT *` in production queries. Always specify exact columns.
- Use `LIMIT` when exploring data on production systems.
- Use `DISTINCT` only when duplicates are a genuine problem — often a symptom of an incorrect `JOIN`.

## INSERT
- Always name target columns explicitly: `INSERT INTO users (name, email) VALUES (...)`.
- Use multi-row `VALUES` syntax or `INSERT INTO ... SELECT` for batch inserts.
- Use upsert syntax (`ON CONFLICT`, `ON DUPLICATE KEY UPDATE`) for idempotent inserts.

## UPDATE
- Every `UPDATE` must have a `WHERE` clause. An `UPDATE` without `WHERE` modifies every row.
- Verify with a `SELECT` using the same `WHERE` clause before executing.
- Wrap in a transaction during manual operations.

## DELETE
- Every `DELETE` must have a specific `WHERE` clause.
- Use `RETURNING *` (PostgreSQL) or `OUTPUT DELETED.*` (SQL Server) for audit logging.
- Consider soft deletes (`UPDATE ... SET deleted_at = NOW()`) for production systems.

## JOINs
- Use explicit `JOIN` syntax (`INNER JOIN`, `LEFT JOIN`) never implicit comma-separated `FROM`.
- Ensure joined columns are indexed on the inner table.
- `NULL = NULL` is false in SQL — handle NULLs explicitly.

## GROUP BY & HAVING
- Every column in `SELECT` must appear in `GROUP BY` or be wrapped in an aggregate function.
- Use `WHERE` to filter before grouping. Use `HAVING` to filter after aggregation.

## Subqueries & CTEs
- Use `WITH` CTEs to decompose complex queries into readable steps.
- Use `EXISTS` over `IN (subquery)` for existence checks — `NOT IN` is dangerous when the subquery can return `NULL`.
- Be aware of CTE materialization behavior in your database.

## Window Functions
- Use `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, `SUM() OVER()` for ranking, running totals, and row-level comparisons.
- Define `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` for running aggregates.

## Indexes
- Create indexes based on `EXPLAIN` evidence — not speculation.
- Composite index column order: equality filters first, sort fields second, range filters last (ESR rule).
- Avoid index-defeating patterns: wrapping columns in functions, leading wildcards, implicit type casts.

## Constraints
- Enforce `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`, `PRIMARY KEY` at the database level.
- Always name constraints explicitly for readable error messages.

## Transactions
- Wrap multi-statement operations in explicit transactions.
- Understand isolation levels: `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`.
- Keep transactions as short as possible.

## Normalization
- 1NF: Atomic values, no repeating groups.
- 2NF: No partial dependencies on composite primary keys.
- 3NF: No transitive dependencies — every non-key column depends directly on the primary key.
- Denormalize deliberately with documented justification.

## Query Optimization
- Run `EXPLAIN` / `EXPLAIN ANALYZE` before deploying queries against large tables.
- Use keyset pagination (`WHERE id > last_seen_id LIMIT n`) instead of offset-based (`LIMIT n OFFSET m`).
- Avoid `COUNT(*)` on large tables for non-exact counts — use table statistics.

## SQL Injection Prevention
- Pass all user-supplied values as bind parameters — never concatenate.
- Use allowlists for dynamic identifiers (column names, table names).
- Stored procedures with dynamic SQL inside (`EXEC`, `EXECUTE IMMEDIATE`) are equally vulnerable if they concatenate.

## Migrations
- Every schema change must be a versioned migration file in source control.
- Apply additive changes before removing old structures.
- Document rollback scripts for every migration.

## Verification Checklist
- [ ] Does every `UPDATE` and `DELETE` have an explicit, verified `WHERE` clause?
- [ ] Are affected rows verified with a `SELECT` before executing?
- [ ] Are all user-supplied values parameterized — never concatenated?
- [ ] Does every `INSERT` specify explicit column names?
- [ ] Is `SELECT *` absent from all production queries?
- [ ] Are destructive operations wrapped in a transaction with a rollback plan?
- [ ] Has `EXPLAIN` been reviewed for new queries against large tables?
- [ ] Are all schema changes version-controlled as migration files?
