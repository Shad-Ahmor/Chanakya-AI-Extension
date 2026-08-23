# Microsoft SQL Server

## Core Principles
- Never execute destructive production SQL blindly. `DROP TABLE`, `TRUNCATE TABLE`, `DELETE` without `WHERE`, `ALTER TABLE ... DROP COLUMN`, and `UPDATE` without `WHERE` are irreversible. Always wrap in a transaction, verify with `SELECT` first, and confirm target database and schema before execution.
- Inspect execution plans for performance problems. Run `SET STATISTICS IO, TIME ON` and review the actual execution plan before deploying any new query against significant row counts.
- Inspect before modifying: use `sp_helptext`, `sys.columns`, `sys.indexes` before changing existing objects.

## Indexes
- **Clustered**: Physically orders rows. One per table. Keep the key narrow and monotonically increasing (`IDENTITY`).
- **Non-Clustered**: Logical ordering. Eliminate Key Lookups by adding needed columns via `INCLUDE`.
- **Filtered Indexes**: Index only a meaningful subset of rows with a `WHERE` clause — reduces index size dramatically.
- Query `sys.dm_db_missing_index_details` for recommended indexes based on actual query patterns.

## Stored Procedures
- Always add `SET NOCOUNT ON` as the first statement — suppresses "N rows affected" messages.
- Use `TRY...CATCH` with `IF @@TRANCOUNT > 0 ROLLBACK` and `THROW` to re-raise.
- Never prefix stored procedures with `sp_` — SQL Server searches `master` first.
- Use `SET XACT_ABORT ON` to auto-rollback on runtime errors.

## Execution Plans — Key Warning Operators
- `Table Scan`: No useful index — full table read.
- `Index Scan`: Index exists but too many rows qualify.
- `Key Lookup`: Non-clustered index satisfied WHERE but additional columns required clustered index hit — add `INCLUDE` columns.
- `Hash Match`: Large in-memory hash join — may indicate missing indexes.
- `Sort`: Extra sort — consider adding an index for the required order.
- Yellow warning triangle: Implicit type conversion or missing statistics — always investigate.

## Transactions
- Always check `@@TRANCOUNT`. Only the outermost `COMMIT` actually commits — `ROLLBACK` always rolls back the outermost transaction.
- Use `SET XACT_ABORT ON` to auto-rollback when any statement raises an error.
- Keep transactions short — long transactions hold locks, block sessions, fill the transaction log.

## Isolation Levels
- Default: `READ COMMITTED`. Enable `READ_COMMITTED_SNAPSHOT ISOLATION (RCSI)` at the database level to eliminate shared read locks without application changes.
- `SNAPSHOT ISOLATION`: Transaction-consistent snapshot without read locks — costs `tempdb` version store usage.
- Avoid `NOLOCK` casually — it allows dirty reads of uncommitted and rolled-back data.

## Query Optimization
- SARGable predicates — avoid: `WHERE YEAR(OrderDate) = 2024` → Use: `WHERE OrderDate >= '2024-01-01' AND OrderDate < '2025-01-01'`.
- Run `UPDATE STATISTICS` after bulk data loads. Enable `AUTO_UPDATE_STATISTICS` on all databases.
- Use `OPTION (RECOMPILE)` for stored procedures suffering from parameter sniffing.

## Security & SQL Injection Prevention
- Use `SqlParameter` or `sp_executesql` with parameters — never concatenate user input into SQL strings.
- Dynamic SQL inside stored procedures using `CONCAT` + `PREPARE` / `EXECUTE` is equally vulnerable.
- `xp_cmdshell` must be disabled in production: `EXEC sp_configure 'xp_cmdshell', 0`.
- Application logins: only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on specific schemas. Never `db_owner` or `sysadmin`.

## Backups
- Set recovery model to `FULL` for all production databases — enables point-in-time recovery.
- Implement: full nightly + differential + transaction log backups every 15–60 minutes.
- Regularly test full restores to a non-production environment.

## Verification Checklist
- [ ] Is the target database confirmed with `USE [DatabaseName]` before executing?
- [ ] Is a `SELECT` run first to verify affected rows before `UPDATE` or `DELETE`?
- [ ] Are destructive operations wrapped in a transaction with `ROLLBACK` fallback?
- [ ] Has the actual execution plan been reviewed for `Table Scan`, `Key Lookup`, and implicit conversions?
- [ ] Are all values parameterized — no string concatenation?
- [ ] Is `SET NOCOUNT ON` and `SET XACT_ABORT ON` in all stored procedures?
- [ ] Are application logins restricted to minimum required permissions?
- [ ] Is `xp_cmdshell` disabled in production?
- [ ] Is the recovery model `FULL` with regular transaction log backups?
