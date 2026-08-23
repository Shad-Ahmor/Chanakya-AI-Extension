# MongoDB

## Core Principles
- Inspect existing schema with `db.collection.findOne()` and indexes with `db.collection.getIndexes()` before writing queries or making changes.
- Never perform bulk destructive operations (`deleteMany`, `drop`, `updateMany` with `$unset`) without first running the equivalent `find()` to understand scope.
- Schema design must be driven by access patterns, not abstract normalization.

## Documents & Collections
- Every document has a unique `_id`. It is immutable after insertion.
- `ObjectId` is a 12-byte BSON type — never compare as strings. Use the driver's `ObjectId` type.
- Use lowercase, plural, descriptive collection names: `users`, `orders`, `product_reviews`.

## Schema Design
- **Embed** when: data is exclusively accessed with the parent, bounded in size, one-to-few relationship.
- **Reference** when: data is large/unbounded, accessed independently, many-to-many, or shared across multiple parents.
- Document size limit is 16MB. Never embed arrays that grow indefinitely over time.
- Set `"dynamic": "false"` or `"dynamic": "strict"` in validation schemas. Avoid unbounded field growth.

## Indexes
- Single Field, Compound, Multikey (arrays), Text, Wildcard, TTL, Sparse — choose based on the query pattern.
- ESR rule for compound indexes: Equality → Sort → Range.
- Always check `.explain("executionStats")`. Look for `COLLSCAN` (bad) vs `IXSCAN` (good).

## Queries
- Always specify a projection in `find()`. Return only needed fields.
- Use `term` for exact matching, `$regex` carefully — leading wildcards cannot use indexes.
- `{ field: null }` matches both null AND missing — use `{ field: { $exists: true, $eq: null } }` to distinguish.

## Aggregation Pipeline
- Place `$match` and `$limit` as early as possible.
- Ensure `$lookup` `foreignField` is indexed — unindexed lookups scan the entire joined collection per document.
- Use `allowDiskUse: true` only for large batch jobs; it signals the pipeline needs optimization.

## Updates
- Use `$set` for partial updates, never `replaceOne()` for partial changes.
- Use `arrayFilters` to update specific elements inside arrays.
- Verify `updateMany()` filter with `find()` first, confirm scope, then execute.

## Transactions
- Use multi-document ACID transactions (available since MongoDB 4.0 on replica sets).
- Keep transactions brief — long transactions hold locks and increase deadlock risk.
- Implement retry logic for transient write conflicts.

## Pagination
- Use cursor-based pagination: `{ _id: { $gt: lastSeenId } }` with `limit()`. Always O(1).
- Avoid `skip(n)` for large offsets — it degrades linearly.

## Security
- Always enable authentication. Never deploy without `--auth`.
- Bind to private network interfaces only — never `0.0.0.0` in production.
- Enable TLS for all connections. Use least-privilege roles for application users.
- Never deserialize user-supplied JSON directly into query objects (`{ "$gt": "" }` bypass).

## Migrations
- Prefer additive migrations (add fields) over transformations.
- Use dual-write pattern when renaming fields. Write to both, migrate reads, backfill, drop old.
- Process large transformations in batches using cursor iteration + `bulkWrite()`.
- Design migration scripts to be idempotent — safe to re-run.

## Verification Checklist
- [ ] Has `db.collection.findOne()` been inspected before writing queries?
- [ ] Has `db.collection.getIndexes()` been run before creating new indexes?
- [ ] Has `.explain("executionStats")` confirmed `IXSCAN` for new queries?
- [ ] Is every `updateMany()` and `deleteMany()` verified with `find()` first?
- [ ] Is `MongoClient` instantiated once and reused — never per-request?
- [ ] Are user-supplied values validated before use in query objects?
