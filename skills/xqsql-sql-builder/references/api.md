# xqsql API Reference

Signatures mirror `lib/types/index.d.ts`. Every builder takes `table` first; identifiers are validated against an allow-list and quoted with backticks before they reach the SQL.

## Signatures

```ts
add(table: string, rows: readonly Record<string, SqlValue>[], fields: readonly Field[]): string
get(table: string, params: PageParams, mode: 'page', field?: string | readonly string[]): PageResult
get(table: string, params: ConditionParams, mode: 'more', field?: string | readonly string[]): string
get(table: string, params: DefaultParams, mode?: 'default', field?: string | readonly string[]): string
up(table: string, params: UpdateParams, fields: readonly Field[], mode?: 'one' | 'more' | 'all'): string
del(table: string, params?: DeleteParams | null | '', mode?: 'one' | 'more' | 'all'): string
create(options?: Options): Xqsql
```

## `add`

| Arg | Type | Notes |
| --- | --- | --- |
| `table` | `string` | `schema.table` allowed |
| `rows` | `Record<string, SqlValue>[]` | non-empty; each row must be a plain object |
| `fields` | `Field[]` | non-empty; fixes column order and required-ness |

Emits `INSERT INTO \`t\` (\`c1\`, \`c2\`) VALUES (v1, v2), (v3, v4)`. Only `fields` are written, an `id` column is not injected, and a column absent from a row encodes as `NULL` unless it is `isMust`.

Errors: 105 (empty `rows` / `fields`), 101 (`isMust` empty), 102/108 (bad column / value).

## `get` — `mode: 'default'`

| `params.type` | Other fields | WHERE |
| --- | --- | --- |
| `'all'` | — | none |
| `'one'` | `key: string`, `ids: [v]` | `` `key` = v `` |
| `'more'` | `key: string`, `ids: [v, ...]` | `` `key` IN (v1, v2) `` |

Errors: 107 (unknown `type`), 106 (`ids` missing or wrong length), 102 (bad `key`).

## `get` — `mode: 'more'`

`params` is the condition object itself: keys are column names.

- column in the instance's `likeFields` -> `` `col` LIKE '%value%' ``
- otherwise -> `` `col` = value ``
- values `undefined`, `null`, `''` are skipped; `0` and `false` are kept
- no remaining condition -> no `WHERE` clause

## `get` — `mode: 'page'`

| Field | Required | Notes |
| --- | --- | --- |
| `limits.size` | yes | non-negative safe integer, also accepts a digit-only string |
| `limits.offset` | no | SQL offset; default `0` |
| `limits.page` | no | 1.x alias of `offset`, same meaning |
| `list` | no | condition object, same rules as `more` |
| `sorts.name` | if `sorts` given | order-by column |
| `sorts.val` | no | `'ASC'` / `'DESC'`, any case, default `DESC` |

Returns `{ sql, count }`:

```text
sql   = SELECT <field> FROM `t` [WHERE ...] [ORDER BY `col` DIR] LIMIT <offset>, <size>
count = SELECT COUNT(*) FROM `t` [WHERE ...]
```

Errors: 103 (`size` / `offset` invalid), 104 (bad `sorts.val`), 102 (missing `sorts.name`).

## `up`

| Field | Notes |
| --- | --- |
| `params.list` | required object; update payload |
| `params.key` / `params.ids` | filter; ignored when `mode: 'all'` |
| `mode` | `'one'` (default) · `'more'` · `'all'` |

A column is written only when it appears in `fields` **and** is an own key of `list`. `undefined` skips it, `null` writes `NULL`, `isMust` rejects `''` / `null` / `undefined`. No writable column -> error 105.

## `del`

`params = { key?, ids? }`. `mode: 'all'` ignores `params` completely, so `del('goods', '', 'all')` and `del('goods', null, 'all')` both work. `'one'` requires exactly one id, `'more'` requires at least one.

## `create`

```ts
create(options?: { likeFields?: string[] }): { add, get, up, del }
```

`likeFields` defaults to `['name', 'user', 'origin_name', 'url']` and is copied into a `Set` per instance, so instances do not share state. Passing a non-object or a non-string-array throws 109.

## `XqSqlError`

```ts
class XqSqlError extends Error {
    readonly code: number;
    readonly msg: string;
    readonly info: string;
    readonly details: Record<string, unknown>;
    toJSON(): { code: number; msg: string; data: { info: string } };
}
```

Runtime access is `xqsql.XqSqlError`; the type is exported from `lib/types/index.d.ts` as a type-only export. `info` is Chinese user-facing text, `msg` is the stable machine-readable name.

## `Field`

| Key | Type | Meaning |
| --- | --- | --- |
| `value` | `string` | column name, validated at call time |
| `name` | `string?` | label used in `请填写<name>!`, defaults to `value` |
| `isMust` | `boolean?` | reject `''` / `null` / `undefined` with code 101 |

## Value Encoding

| JS value | SQL | Note |
| --- | --- | --- |
| `'apple'` | `'apple'` | single quotes |
| `"o'brien"` | `'o\'brien'` | quote escaped |
| `'a\b'` | `'a\\b'` | backslash escaped first |
| `'a\nb'` | `'a\nb'` | `\n` `\r` `\t` `\b` `\0` `\Z` escaped |
| `10` | `10` | as-is |
| `8.8` | `8.8` | decimals preserved |
| `NaN` / `Infinity` | — | throws 108 |
| `9007199254740993n` | `9007199254740993` | `toString()` |
| `true` / `false` | `1` / `0` | MySQL has no boolean literal |
| `null` / `undefined` | `NULL` | `undefined` inside `up().list` skips the column instead |
| `new Date(2026, 9, 21, 9, 30, 0)` | `'2026-10-21 09:30:00'` | local time, DATETIME layout |
| array / plain object / function | — | throws 108 |

## Error Codes

| code | msg | Raised when |
| --- | --- | --- |
| 101 | `save_fail` | `isMust` field is `''` / `null` / `undefined` |
| 102 | `invalid_identifier` | table / column / condition key / sort column fails the allow-list; missing `sorts.name`; empty `field` list |
| 103 | `invalid_number` | `limits.size` / `limits.offset` missing, negative, or not a safe integer |
| 104 | `invalid_order` | `sorts.val` is neither `ASC` nor `DESC` |
| 105 | `empty_input` | empty `rows` / `fields`; `up` with no writable column |
| 106 | `invalid_ids` | `ids` not an array, or wrong length for the mode |
| 107 | `invalid_mode` | unknown `mode` or `params.type` |
| 108 | `invalid_value` | object, array, `NaN`, `Infinity`, invalid `Date` |
| 109 | `invalid_argument` | `params` / `list` / `limits` / `sorts` not an object; bad `create` options |

## Identifier Rules

- Column, condition key, sort column: `/^[A-Za-z_][A-Za-z0-9_$]{0,63}$/`
- Table: the same pattern, optionally as `schema.table`
- Output is always backtick-quoted; `ASC` / `DESC` is normalized to uppercase
