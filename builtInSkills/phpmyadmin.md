# phpMyAdmin

## Core Principles
- phpMyAdmin is a web-based administration interface that communicates with an underlying MySQL/MariaDB database server. It is NOT the database itself. Every action in phpMyAdmin is a real, permanent database operation — there is no undo button.
- Always verify the target database in the left panel before executing any statement.
- Inspect the current table schema via the Structure tab before writing any query.
- Never execute destructive operations without first running the equivalent `SELECT` with the same `WHERE` clause.

## Database Inspection
- The left sidebar lists all databases the current user has access to. Confirm the correct database is selected before every operation.
- Use the Structure tab to inspect column names, data types, defaults, nullability, and key designations before writing queries.
- Use `INFORMATION_SCHEMA.COLUMNS` and `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` for programmatic schema inspection.

## Safe SQL Execution
- Always confirm the active database shown in the SQL editor panel before executing statements.
- Test with `SELECT` before executing `UPDATE` or `DELETE` — verify the exact rows and row count.
- Wrap destructive statements in a transaction in the SQL editor (`START TRANSACTION` → review → `ROLLBACK` to verify → `COMMIT` when confident).
- Always use `LIMIT` when exploring large tables to prevent rendering millions of rows.

## Destructive Operation Safety
- `DROP TABLE`: Permanently deletes table and all data. Always export the table first.
- `TRUNCATE TABLE`: Cannot be rolled back in MySQL — implicit commit inside transactions. Confirm the correct table name.
- `DELETE` without `WHERE`: Deletes every row. Always verify `WHERE` clause with `SELECT` first.
- `ALTER TABLE ... DROP COLUMN`: Permanently removes column and data. Back up first.
- `DROP DATABASE`: Destroys the entire database. Read the confirmation dialog carefully.

## Indexes
- Check existing indexes via Structure tab → Indexes section or `SHOW INDEX FROM tablename` before adding new ones.
- Use `EXPLAIN SELECT ...` to verify index usage for slow queries.
- Never add duplicate indexes — they waste storage and slow writes.

## Import & Export
- Verify character set matches between import file and target table — UTF-8 file into `latin1` table produces garbled data.
- phpMyAdmin has file size limits for imports (`upload_max_filesize`). For large imports, use MySQL command-line: `mysql -u user -p database < dump.sql`.
- phpMyAdmin disables `FOREIGN_KEY_CHECKS` during imports — verify data integrity after large imports.

## Backups
- Always export a full database backup before migrations, `ALTER TABLE`, or bulk changes.
- Name backups descriptively: `production_orders_2024-01-15_before-migration.sql`.
- Regularly test restoring backups to a non-production environment.

## SQL Injection Awareness
- SQL executed in phpMyAdmin's SQL tab is typed by a trusted human — injection is not a concern there.
- But patterns designed in phpMyAdmin for application code MUST be parameterized when used programmatically. Never copy a query that interpolates variables directly into application database layer code.

## Verification Checklist
- [ ] Is the correct database confirmed in the left panel before executing any statement?
- [ ] Has the target table schema been inspected via the Structure tab?
- [ ] Has a `SELECT` with the same `WHERE` clause been run before `UPDATE` or `DELETE`?
- [ ] Is a full database backup exported before any migration or bulk change?
- [ ] Are destructive operations wrapped in a transaction with `ROLLBACK` tested first?
- [ ] Are `EXPLAIN` results reviewed for new queries against large tables?
- [ ] Are phpMyAdmin-designed queries parameterized when transferred to application code?
