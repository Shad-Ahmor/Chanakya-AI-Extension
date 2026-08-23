# Elasticsearch

## Core Principles
- Inspect existing mappings with `GET /index-name/_mapping` and settings with `GET /index-name/_settings` before writing any query or modifying fields.
- Never delete and recreate a production index. Use the Reindex API + alias swap for mapping changes.
- Application code must always point to index aliases, never to index names directly.

## Mappings
- Mapping field types are immutable after creation. The only way to change a field type is to create a new index and reindex.
- Always define explicit mappings. Never rely on dynamic mapping auto-detection in production.
- Set `"dynamic": "false"` or `"dynamic": "strict"` on production indexes.
- Use multi-fields for `text` + `keyword`: `"fields": { "keyword": { "type": "keyword" } }`.

## Field Types
- `text`: Full-text search (analyzed, tokenized). Not for aggregations, sorting, or exact matching.
- `keyword`: Exact matching, filtering, sorting, aggregations. Use for IDs, status, email, tags.
- `date`: Always specify `format` explicitly.
- `nested`: For arrays of objects where inner-object relationships must be preserved.

## Queries
- Use **filter context** (`filter`, `must_not`) for structured data — binary match, cached, no score computed.
- Use **query context** (`must`, `should`) for full-text search where ranking matters.
- `term` for `keyword` fields. `match` for `text` fields. Never swap — it produces incorrect results.
- Avoid leading-wildcard regex — it scans every term in the inverted index.

## Aggregations
- `terms` aggregation requires a `keyword` or numeric field — never a `text` field (requires `fielddata: true` which is memory-intensive).
- Set `"size": 0` when only aggregation results are needed, not document hits.

## Pagination
- Use `search_after` with a unique sort field for efficient deep pagination.
- Never use `from` + `size` beyond `index.max_result_window` (default 10,000).
- Use Point In Time (PIT) for consistent pagination across concurrent index updates.

## Aliases
- Zero-downtime reindex pattern: Create new index → Reindex via API → Atomically swap alias → Delete old index.
- Use filtered aliases to expose a logical subset of an index as a virtual index.

## Performance
- Shard size target: 10GB–50GB per shard.
- Avoid wildcard and regex queries on large indexes — use n-gram analyzers at index time instead.
- Use `_source: false` only when disk space is critical and updates/reindex/highlighting are not needed.

## Security
- Security is enabled by default since Elasticsearch 8.0. Never disable it.
- Enable TLS for HTTP and transport communication.
- Create dedicated roles with minimum privileges — never use the `elastic` superuser for application access.

## Debugging
- `GET /index/_explain/{id}`: Understand why a document matched and how its score was computed.
- `GET /index/_validate/query?explain=true`: Validate query syntax without executing.
- `GET _cat/indices?v`, `GET _cat/shards?v`: Human-readable cluster health overview.

## Verification Checklist
- [ ] Has `GET /index/_mapping` been retrieved before writing queries or adding fields?
- [ ] Are all application code paths using index aliases rather than index names?
- [ ] Is filter context used for structured criteria — not query context?
- [ ] Is `term` used for `keyword` fields and `match` for `text` fields?
- [ ] Are aggregations using `keyword` or numeric fields — not raw `text`?
- [ ] Is the Bulk API used for all multi-document indexing?
- [ ] Is cursor-based pagination used instead of `from` for deep pagination?
- [ ] Is `dynamic: false` or `dynamic: strict` set on production index mappings?
