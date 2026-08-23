# PostgreSQL

## Core Principles
- Inspect existing schema (`\d tablename`, `\di tablename`) and database-level settings before writing queries or making changes.
- Never execute destructive SQL without understanding the target data. Always run `SELECT` with the same `WHERE` clause first.
- Use parameterized queries. PostgreSQL's `$1`, `$2` placeholders prevent SQL injection.

## Schema & Types
- Use `SERIAL` or `BIGSERIAL` (or `GENERATED ALWAYS AS IDENTITY` in PostgreSQL 10+) for auto-increment primary keys.
- Use `TIMESTAMPTZ` (timestamp with time zone) for all timestamp columns — store in UTC, display in local time.
- Use `DECIMAL`/`NUMERIC` for monetary values — never `FLOAT` or `REAL`.
- Use `TEXT` for variable-length strings — PostgreSQL optimizes storage automatically. `VARCHAR(n)` adds a length constraint.
- Use `JSONB` for semi-structured data — it is binary, indexed, and faster than `JSON`.

## Indexes
- Create indexes based on `EXPLAIN ANALYZE` evidence — not speculation.
- `CREATE INDEX CONCURRENTLY` for adding indexes to production tables without locking.
- GIN indexes for `JSONB`, `tsvector` (full-text search), and array columns.
- Partial indexes with `WHERE` clause to index only relevant rows.
- Expression indexes for queries that filter on expressions: `CREATE INDEX ON users (lower(email))`.

## Queries
- Use `EXPLAIN ANALYZE` to see actual execution statistics — not just the estimated plan.
- Use `RETURNING *` clause on `INSERT`, `UPDATE`, `DELETE` to capture affected rows.
- Use CTEs (`WITH`) for complex queries. Be aware of CTE materialization behavior (`MATERIALIZED` vs `NOT MATERIALIZED`).

## Transactions & MVCC
- PostgreSQL uses MVCC — each transaction sees a consistent snapshot. `VACUUM` reclaims dead tuples.
- Run `VACUUM ANALYZE` after bulk data operations.
- Use `SERIALIZABLE` isolation for financial transactions requiring full consistency.
- Avoid long-running transactions — they hold back `VACUUM` and increase table bloat.

## Security
- Use `pg_hba.conf` to restrict connections by host, user, and database.
- Never use the `postgres` superuser for application connections.
- Enable SSL: `ssl = on` in `postgresql.conf`.
- Use Row Level Security (RLS) for multi-tenant databases.

## Verification Checklist
- [ ] Is existing schema inspected before writing queries?
- [ ] Is `EXPLAIN ANALYZE` reviewed for new queries?
- [ ] Is `CREATE INDEX CONCURRENTLY` used for production index additions?
- [ ] Is `TIMESTAMPTZ` used for all timestamp columns?
- [ ] Are application users non-superuser with minimum required privileges?
