# xqsql

Zero-dependency MySQL statement builder with safe quoting.

> It builds SQL **text** only — no connection, no execution, no parameter binding.
> Since 2.0.0 every invalid input throws an `XqSqlError` carrying a numeric `code`; there is no more `ReferenceError`, `TypeError`, or silent `undefined`.

[中文文档](./zh.md) · [Changelog](./CHANGELOG.md)

---

## Install

```bash
npm install xqsql
```

| Environment | Usage | Resolves to |
| --- | --- | --- |
| Node (CJS) | `const xqsql = require('xqsql');` | `main` → `lib/xqsql.js` |
| Node / bundler (ESM) | `import xqsql from 'xqsql';`<br>`import { add, get, up, del } from 'xqsql';` | `exports.import` → `lib/xqsql-esm.mjs` |
| Browser `<script>` | `<script src="xqsql/lib/xqsql.min.js"></script>` | UMD, exposes `window.xqsql` |
| CDN | `https://xqgj.cc/xqcdn/libs/xqsql/xqsql.min.js` | same file as in the npm package |

TypeScript works out of the box: `lib/types/index.d.ts` ships with the package and `get(..., 'page')` is typed as `{ sql: string; count: string }`.

---

## Quick start

```js
const xqsql = require('xqsql');

const GOODS_FIELDS = [
    { name: 'name', value: 'name' },
    { name: 'qty', value: 'number' },
    { name: 'price', value: 'price' },
];

// INSERT
xqsql.add('goods', [
    { name: 'apple', number: 10, price: 8.8 },
    { name: 'blueberry', number: 20, price: 9.9 },
], GOODS_FIELDS);
// INSERT INTO `goods` (`name`, `number`, `price`) VALUES ('apple', 10, 8.8), ('blueberry', 20, 9.9)

// SELECT one
xqsql.get('goods', { type: 'one', key: 'id', ids: [1] });
// SELECT * FROM `goods` WHERE `id` = 1

// SELECT with conditions (columns in the likeFields allow-list use LIKE)
xqsql.get('goods', { name: 'apple', number: 10 }, 'more');
// SELECT * FROM `goods` WHERE `name` LIKE '%apple%' AND `number` = 10

// SELECT with pagination -> { sql, count }
xqsql.get('goods', {
    list: { name: 'banana' },
    sorts: { name: 'create_time', val: 'DESC' },
    limits: { offset: 0, size: 10 },
}, 'page');
// {
//   sql:   "SELECT * FROM `goods` WHERE `name` LIKE '%banana%' ORDER BY `create_time` DESC LIMIT 0, 10",
//   count: "SELECT COUNT(*) FROM `goods` WHERE `name` LIKE '%banana%'"
// }

// UPDATE
xqsql.up('goods', { key: 'id', ids: [1], list: { number: 10, price: 9.9 } }, GOODS_FIELDS);
// UPDATE `goods` SET `number` = 10, `price` = 9.9 WHERE `id` = 1

// DELETE
xqsql.del('goods', { key: 'id', ids: [1, 2, 3] }, 'more');
// DELETE FROM `goods` WHERE `id` IN (1, 2, 3)
```

---

## API

Every builder takes `table` as its first argument. It is validated against an allow-list regex and wrapped in backticks; `schema.table` is supported.

### `add(table, rows, fields) → string`

| Arg | Type | Notes |
| --- | --- | --- |
| `table` | `string` | `schema.table` allowed |
| `rows` | `Array<Record<string, SqlValue>>` | non-empty |
| `fields` | `Array<Field>` | non-empty; defines column order and required-ness |

`Field` = `{ value: string, name?: string, isMust?: boolean }`. `value` is the column name, `name` is only used in error messages (defaults to `value`), and `isMust: true` rejects `''` / `null` / `undefined`.

Only columns declared in `fields` are written; extra keys in a row are ignored.
The `id` column is **no longer injected automatically** — add `{ value: 'id' }` to `fields` and give it a value if you need an explicit primary key.

### `get(table, params, mode?, field?) → string | { sql, count }`

`mode`: `'default'` (default) · `'more'` · `'page'`. `field` defaults to `'*'`; accepts `['id','name']` or `'id,name'`.

**`default`** — by primary key:

| `params.type` | Other fields | WHERE |
| --- | --- | --- |
| `'all'` | — | none |
| `'one'` | `key`, `ids` (exactly 1) | `` `key` = v `` |
| `'more'` | `key`, `ids` (≥ 1) | `` `key` IN (v1, v2) `` |

**`more`** — by condition object. Keys are column names; a key in `likeFields` becomes `` `col` LIKE '%v%' ``, otherwise `` `col` = v ``. `undefined` / `null` / `''` conditions are skipped, but `0` and `false` are kept.

**`page`** — returns `{ sql, count }`:

| Field | Required | Notes |
| --- | --- | --- |
| `limits.size` | yes | non-negative integer |
| `limits.offset` | no | SQL OFFSET, **not a page number**; defaults to 0 |
| `limits.page` | no | alias of `offset`, kept for 1.x compatibility |
| `list` | no | condition object, same rules as `more` |
| `sorts.name` | if `sorts` given | order-by column |
| `sorts.val` | no | `'ASC'` / `'DESC'`, any case; defaults to `DESC` |

> Compute it yourself: `offset = (page - 1) * size`.

### `up(table, params, fields, mode?) → string`

`mode`: `'one'` (default) · `'more'` · `'all'`.

`params.list` is the update payload, `params.key` / `params.ids` are the filter (`all` ignores them). Only columns declared in `fields` **and** present in `list` are updated.
`undefined` means "skip this column"; `null` writes `NULL`.

```js
xqsql.up('goods', { key: 'id', ids: [1, 2], list: { price: 9.9 } }, GOODS_FIELDS, 'more');
// UPDATE `goods` SET `price` = 9.9 WHERE `id` IN (1, 2)
```

### `del(table, params?, mode?) → string`

`mode`: `'one'` (default) · `'more'` · `'all'`. `'all'` ignores `params`, so `del('goods', '', 'all')` still works.

### `create({ likeFields }) → instance`

Returns an isolated instance with its own LIKE allow-list. Default: `['name', 'user', 'origin_name', 'url']`.

```js
const sql = xqsql.create({ likeFields: ['title'] });
sql.get('goods', { title: 'x', name: 'y' }, 'more');
// SELECT * FROM `goods` WHERE `title` LIKE '%x%' AND `name` = 'y'
```

### `XqSqlError`

```js
try {
    xqsql.add('goods', [{ name: '' }], [{ name: 'name', value: 'name', isMust: true }]);
} catch (error) {
    error.code;    // 101
    error.msg;     // 'save_fail'
    error.info;    // '请填写name!'
    error.details; // { table: 'goods', field: 'name' }
    error.toJSON();// { code: 101, msg: 'save_fail', data: { info: '请填写name!' } }
}
```

`toJSON()` matches the response shape that 1.x wrote through `res.json(...)`, so Express handlers can simply `return res.json(error.toJSON())`.

---

## Value encoding

| JS value | SQL | Note |
| --- | --- | --- |
| `'apple'` | `'apple'` | single quotes |
| `"o'brien"` | `'o\'brien'` | quote escaped |
| `'a\b'` | `'a\\b'` | backslash escaped first |
| `'a\nb'` | `'a\nb'` | `\n` `\r` `\t` `\b` `\0` `\Z` escaped |
| `10` | `10` | as-is |
| `8.8` | `8.8` | **no longer truncated to `8`** |
| `NaN` / `Infinity` | throws 108 | non-finite rejected |
| `9007199254740993n` | `9007199254740993` | bigint via `toString()` |
| `true` / `false` | `1` / `0` | MySQL has no boolean literal |
| `null` / `undefined` | `NULL` | 1.x wrote the string `"null"` |
| `new Date(2026,9,21,9,30,0)` | `'2026-10-21 09:30:00'` | local time, DATETIME format |
| array / plain object | throws 108 | no silent `[object Object]` |

Identifiers (table, column, condition key, sort column) must match `^[A-Za-z_][A-Za-z0-9_$]{0,63}$`; anything else throws 102.

---

## Error codes

| code | msg | When |
| --- | --- | --- |
| 101 | `save_fail` | an `isMust` field is `''` / `null` / `undefined` |
| 102 | `invalid_identifier` | bad table / column / condition key / sort column; missing `sorts.name` |
| 103 | `invalid_number` | `limits.size` / `limits.offset` missing or not a non-negative integer |
| 104 | `invalid_order` | `sorts.val` is neither `ASC` nor `DESC` |
| 105 | `empty_input` | empty `rows` / `fields`; no updatable column in `up` |
| 106 | `invalid_ids` | `ids` is not an array or has the wrong length for the mode |
| 107 | `invalid_mode` | unknown `mode` or `params.type` |
| 108 | `invalid_value` | unsupported value type (object, array, `NaN`, invalid `Date`) |
| 109 | `invalid_argument` | `params` / `list` / `limits` / `sorts` is not an object; bad `create` options |

---

## Security

Hardened in 2.0.0:

- **Values** — single quotes with backslash escaping for `\` `'` `\0` `\n` `\r` `\t` `\b` `\Z`.
- **Identifiers** — allow-list regex for table, column, condition key and sort column; invalid input throws instead of reaching the SQL.
- **Order direction** — `ASC` / `DESC` only, emitted uppercase.
- **LIMIT / OFFSET** — forced to non-negative safe integers.

**Limits you should still be aware of:**

1. The output is **concatenated SQL text**; there is no `?` placeholder or parameter binding. For fully untrusted input, use a driver with prepared statements (e.g. `mysql2`'s `execute`).
2. `%` and `_` inside `LIKE` conditions pass through as wildcards. Escape them yourself if you need literal matching.
3. Validation covers injection, **not business logic** — `del('goods', '', 'all')` really does produce a full-table delete.

---

## Migrating to 2.0.0

| 1.x behavior | 2.0.0 behavior | What to change |
| --- | --- | --- |
| double-quoted strings `"apple"` | single-quoted `'apple'` | nothing to change; works under `ANSI_QUOTES` now |
| `price: 8.8` → `8` | `price: 8.8` → `8.8` | check code that relied on the truncation |
| `add()` injected an `id` column with `(0, …)` | no longer injected | add `{ value: 'id' }` to `fields` if you need it |
| `up()` empty required field → `ReferenceError: res is not defined` | throws `XqSqlError(101)` | catch with `instanceof xqsql.XqSqlError` |
| `up(..., 'all')` without `ids` → `TypeError` | works | nothing |
| `del(..., 'one')` without `ids` → `TypeError` | throws 106 | pass `ids`, or use `del(table, '', 'all')` |
| `get({ type: 'one' })` without `ids` → `TypeError` | throws 106 | pass `ids` |
| unknown `type` → `undefined` | throws 107 | add `try/catch` |
| `null` → string `"null"` | `NULL` | audit code that matched the literal `"null"` |
| `up()` wrote `"undefined"` | column skipped | pass `null` explicitly to clear a column |
| `COUNT(id)` | `COUNT(*)` | nothing |
| only `limits.page` (really offset) | `limits.offset` is now the preferred name | prefer `offset`; `page` still works |
| — | `exports` narrowed | deep imports only via `xqsql/lib/*` |

```js
try {
    const sql = xqsql.add('goods', rows, fields);
    res.json({ code: 100, msg: 'save_ok', data: { sql } });
} catch (error) {
    if (error instanceof xqsql.XqSqlError) return res.json(error.toJSON());
    next(error);
}
```

---

## Browser test pages

```bash
npm run test:browser        # local server at http://127.0.0.1:8080/
npm run test:browser:check  # run all pages in a real browser and report
```

`test/index.html` links to `browser.html` (UMD), `esm.html` (ES module) and `amd.html` (AMD with a vendored require.js 2.3.6). Each page renders visible PASS/FAIL rows and leaves a usable instance on `window` for manual experiments.

---

## Development

```bash
npm run build               # rebuild everything in lib/ with esbuild
npm test                    # build, then node --test
npm run typecheck           # tsc --noEmit
npm run test:browser:check  # real-browser verification
npm run verify              # all of the above
```

Source lives in `src/`. Do **not** edit `lib/xqsql*.js` by hand — they are generated by `scripts/build.mjs`, and `pretest` rebuilds them.

---

## License

MIT © gitguanqi
