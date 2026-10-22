---
name: xqsql-sql-builder
description: Integrate the xqsql zero-dependency MySQL statement builder into a Node service, script, or browser page - pick the right entry point, assemble INSERT/SELECT/UPDATE/DELETE text, execute it with a driver, and map XqSqlError codes to responses. Load when adding xqsql to a project or when replacing hand-written SQL strings with xqsql calls.
---

# xqsql Integration

xqsql turns JavaScript objects into MySQL statement **text**. Treat it as a serializer that sits in front of a driver, not as a database client.

## Decide The Entry First

| Runtime | Import | Resolves to |
| --- | --- | --- |
| Node, `require` | `const xqsql = require('xqsql')` | `lib/xqsql.js` (UMD) |
| Node / bundler, ESM | `import xqsql, { add, get, up, del } from 'xqsql'` | `lib/xqsql-esm.mjs` |
| Browser `<script>` | `xqsql/lib/xqsql.min.js` then `window.xqsql` | UMD file, also on CDN |
| AMD | `require(['xqsql'], (xqsql) => ...)` | same UMD file |

Rules that trip integrations up:

- Only the four builders are named exports. `create` and `XqSqlError` exist on the default/namespace object: `xqsql.create(...)`, `error instanceof xqsql.XqSqlError`.
- `exports` is narrowed to `.`, `./lib/*` and `./package.json`. Do not import `xqsql/src/*` — `src/` is not published.
- The ESM and UMD builds are generated from `src/` by `scripts/build.mjs`. Never hand-edit anything in `lib/`.

## Integration Order

1. **Declare the field list once per table.** `add` and `up` both require `fields: [{ value, name?, isMust? }]`. `value` is the column name and is the only thing used in SQL; `name` is cosmetic (error text). Reuse one constant so `add` and `up` cannot drift.
2. **Build the statement** with `add` / `get` / `up` / `del`. Choose `get`'s mode deliberately:
   - primary key lookups -> `mode: 'default'` with `{ type: 'one' | 'more' | 'all', key, ids }`
   - filter forms / search boxes -> `mode: 'more'` with a condition object
   - list pages -> `mode: 'page'`, which returns `{ sql, count }` in one call
3. **Execute it with your driver**, e.g. `const [rows] = await pool.query(sql)`.
4. **Convert failures once, at the boundary.** Catch `XqSqlError` and return `error.toJSON()` — it is already `{ code, msg, data: { info } }`, the shape 1.x wrote through `res.json`.

```js
// routes/goods.js
const xqsql = require('xqsql');

const GOODS_FIELDS = [
    { name: 'name', value: 'name', isMust: true },
    { name: 'qty', value: 'number' },
    { name: 'price', value: 'price' },
];

router.get('/goods', async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const size = Number(req.query.size) || 20;
        const { sql, count } = xqsql.get('goods', {
            list: { name: req.query.name },
            sorts: { name: 'create_time', val: 'DESC' },
            limits: { offset: (page - 1) * size, size },
        }, 'page');

        const [[{ total }]] = await pool.query(count);
        const [rows] = await pool.query(sql);
        res.json({ code: 100, msg: 'ok', data: { total, rows } });
    } catch (error) {
        if (error instanceof xqsql.XqSqlError) return res.json(error.toJSON());
        next(error);
    }
});

router.put('/goods/:id', async (req, res, next) => {
    try {
        const sql = xqsql.up('goods', { key: 'id', ids: [req.params.id], list: req.body }, GOODS_FIELDS);
        await pool.query(sql);
        res.json({ code: 100, msg: 'save_ok' });
    } catch (error) {
        if (error instanceof xqsql.XqSqlError) return res.json(error.toJSON());
        next(error);
    }
});
```

## Non-Obvious Constraints

- **No parameter binding.** The result is concatenated SQL with escaping applied. That is fine for `pool.query`, but if a caller can supply values you should keep them out of raw SQL or move to prepared statements.
- **`add` does not inject `id`.** It writes only the columns in `fields`; a column missing from a row becomes `NULL` unless it is `isMust`.
- **`up` distinguishes `undefined` from `null`.** `undefined` means "do not touch this column", `null` writes `NULL`. Because of that, `{ ...dto }` spreads with absent keys behave as partial updates.
- **`more` conditions silently drop empties.** `''`, `null`, `undefined` are skipped (handy for optional filters), but `0` and `false` are kept. A condition object that ends up empty produces an unfiltered `SELECT`.
- **`likeFields` decides `=` versus `LIKE`.** Default is `['name', 'user', 'origin_name', 'url']`. For other columns use `xqsql.create({ likeFields: [...] })` rather than pre-wrapping values in `%`.
- **`limits.offset` is a row offset, not a page number.** `limits.page` is a 1.x alias for the same offset.
- **`del(..., 'all')` and `up(..., 'all')` drop the WHERE clause on purpose.** Validation is not a safety net; gate full-table writes in your own code.
- **Errors are thrown, not returned.** Wrap build calls in `try/catch`; nothing returns `undefined` any more.
- **Identifiers are ASCII-only** (`/^[A-Za-z_][A-Za-z0-9_$]{0,63}$/`). Column names with spaces or CJK characters must be aliased in the database.

Exact signatures, defaults and the value-encoding table: see [references/api.md](references/api.md).

## Verify The Integration

- `npm test` — builds `lib/` and runs the builder, entry-consistency, type, packaging and metadata suites.
- `npm run typecheck` — `tsc --noEmit` against `lib/types/index.d.ts` and `test/ts-fixture/usage.ts`.
- `npm run test:browser` + `npm run test:browser:check` — real-browser checks of the UMD, ESM and AMD pages.
- `npm run verify` — all of the above in one go.

When you change the public API, update `lib/types/index.d.ts`, `test/ts-fixture/usage.ts`, `llms.txt` and `references/api.md` together; the metadata test fails if they disagree.
