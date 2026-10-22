# xqsql 中文文档（2.0.0）

> 零依赖的 MySQL 语句拼接库。只负责把 JS 数据拼成 SQL 文本，**不连接数据库、不执行 SQL、不做参数化绑定**。
>
> 2.0.0 起，所有非法输入都会抛出带 `code` 的 `XqSqlError`，不再出现 `ReferenceError`、`TypeError` 或静默返回 `undefined`。

---

## 目录

- [安装与引入](#安装与引入)
- [快速开始](#快速开始)
- [API](#api)
  - [add](#add---插入)
  - [get](#get---查询)
  - [up](#up---更新)
  - [del](#del---删除)
  - [create](#create---独立实例)
  - [XqSqlError](#xqsqlerror)
- [值编码规则](#值编码规则)
- [错误码](#错误码)
- [安全声明](#安全声明)
- [迁移到 200](#迁移到-200)
- [本地测试页面](#本地测试页面)
- [AI 元数据](#ai-元数据)
- [开发](#开发)

---

## 安装与引入

```bash
npm install xqsql
```

四种引入方式，按你的运行环境挑一个：

| 环境 | 写法 | 说明 |
| --- | --- | --- |
| Node（CommonJS） | `const xqsql = require('xqsql');` | 走 `main`，即 `lib/xqsql.js` |
| Node / 打包器（ESM） | `import xqsql from 'xqsql';`<br>`import { add, get, up, del } from 'xqsql';` | 走 `exports.import`，即 `lib/xqsql-esm.mjs` |
| 浏览器 `<script>` | `<script src="xqsql/lib/xqsql.min.js"></script>` | 暴露全局 `window.xqsql`（UMD） |
| CDN | `https://xqgj.cc/xqcdn/libs/xqsql/xqsql.min.js` | 与 npm 包内同名文件保持一致 |

```js
// CJS
const xqsql = require('xqsql');
const { add, get, up, del } = require('xqsql');

// ESM：默认导出是包含全部方法的对象，四个构造器另有命名导出
import xqsql from 'xqsql';
import xqsql, { add, get, up, del } from 'xqsql';

// 浏览器（UMD）
// <script src="xqsql/lib/xqsql.min.js"></script>
// window.xqsql.add(...)  window.xqsql.get(...)  ...

// AMD
require(['xqsql'], function (xqsql) { /* xqsql.add(...) */ });
```

TypeScript 开箱可用：包内自带 `lib/types/index.d.ts`，`get(..., 'page')` 会自动推导为 `{ sql: string; count: string }`。

---

## 快速开始

```js
const xqsql = require('xqsql');

const GOODS_FIELDS = [
    { name: '商品名称', value: 'name' },
    { name: '商品数量', value: 'number' },
    { name: '商品价格', value: 'price' },
];

// 插入
xqsql.add('goods', [
    { name: '苹果', number: 10, price: 8.8 },
    { name: '蓝莓', number: 20, price: 9.9 },
], GOODS_FIELDS);
// INSERT INTO `goods` (`name`, `number`, `price`) VALUES ('苹果', 10, 8.8), ('蓝莓', 20, 9.9)

// 查询单条
xqsql.get('goods', { type: 'one', key: 'id', ids: [1] });
// SELECT * FROM `goods` WHERE `id` = 1

// 条件查询（列名在 likeFields 白名单里走 LIKE）
xqsql.get('goods', { name: '苹果', number: 10 }, 'more');
// SELECT * FROM `goods` WHERE `name` LIKE '%苹果%' AND `number` = 10

// 分页查询
xqsql.get('goods', {
    list: { name: '香蕉', number: 0 },
    sorts: { name: 'create_time', val: 'DESC' },
    limits: { offset: 0, size: 10 },
}, 'page');
// {
//   sql:   "SELECT * FROM `goods` WHERE `name` LIKE '%香蕉%' AND `number` = 0 ORDER BY `create_time` DESC LIMIT 0, 10",
//   count: "SELECT COUNT(*) FROM `goods` WHERE `name` LIKE '%香蕉%' AND `number` = 0"
// }

// 更新
xqsql.up('goods', { key: 'id', ids: [1], list: { number: 10, price: 9.9 } }, GOODS_FIELDS);
// UPDATE `goods` SET `number` = 10, `price` = 9.9 WHERE `id` = 1

// 删除
xqsql.del('goods', { key: 'id', ids: [1, 2, 3] }, 'more');
// DELETE FROM `goods` WHERE `id` IN (1, 2, 3)
```

---

## API

四个构造器的第一个参数都是 `table`，会被白名单校验并加反引号。表名允许 `schema.table` 两段式。

### add — 插入

```js
add(table, rows, fields) → string
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `table` | `string` | 表名，支持 `schema.table` |
| `rows` | `Array<Record<string, SqlValue>>` | **非空**行数组；每行的键对应列名 |
| `fields` | `Array<Field>` | **非空**字段描述，决定列顺序与必填校验 |

`Field`：`{ value: string, name?: string, isMust?: boolean }`。`value` 是列名（会被校验），`name` 只用于错误文案（缺省时取 `value`），`isMust: true` 时该列不允许 `''` / `null` / `undefined`。

- 只写入 `fields` 里声明过的列，行数据里的多余键被忽略。
- **不再自动注入 `id` 列**。需要显式主键，就把 `{ value: 'id' }` 放进 `fields` 并在每行给值。
- 抛错场景：`rows` 非数组或为空（105）、`fields` 为空（105）、某行不是对象（109）、必填列为空（101）、列名非法（102）、值类型不支持（108）。

```js
xqsql.add('goods', [{ name: null, number: true, price: undefined }], GOODS_FIELDS);
// INSERT INTO `goods` (`name`, `number`, `price`) VALUES (NULL, 1, NULL)
```

### get — 查询

```js
get(table, params, mode?, field?) → string | { sql, count }
```

`mode` 取值：`'default'`（默认）、`'more'`、`'page'`。`field` 省略时为 `'*'`，可传数组 `['id','name']` 或逗号分隔字符串 `'id,name'`。

**`default` 模式** —— 按主键取：

| `params.type` | `params` 其他字段 | 生成的 WHERE |
| --- | --- | --- |
| `'all'` | 无 | 不加 WHERE |
| `'one'` | `key`、`ids`（长度必须恰好为 1） | `` `key` = value `` |
| `'more'` | `key`、`ids`（至少一个） | `` `key` IN (v1, v2) `` |

```js
xqsql.get('goods', { type: 'all' });                        // SELECT * FROM `goods`
xqsql.get('goods', { type: 'one', key: 'id', ids: [1] });    // WHERE `id` = 1
xqsql.get('goods', { type: 'more', key: 'id', ids: [1,2,3] });// WHERE `id` IN (1, 2, 3)
xqsql.get('goods', { type: 'all' }, 'default', ['id','name']); // SELECT `id`, `name` FROM `goods`
```

**`more` 模式** —— 按条件对象取：

- 键为列名，值按[值编码规则](#值编码规则)处理。
- 键命中 `likeFields` 白名单时生成 `` `col` LIKE '%value%' ``，否则生成 `` `col` = value ``。
- `undefined` / `null` / `''` 的条件会被**跳过**（但 `0` 与 `false` 保留）。
- 没有任何有效条件时不加 `WHERE`，返回全表查询。

```js
xqsql.get('goods', { name: '苹果', number: 10 }, 'more');
// SELECT * FROM `goods` WHERE `name` LIKE '%苹果%' AND `number` = 10
```

**`page` 模式** —— 分页，返回 `{ sql, count }`：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `limits.size` | 是 | 每页条数，非负整数 |
| `limits.offset` | 否 | **SQL 的 OFFSET**，不是页码。默认 0 |
| `limits.page` | 否 | `offset` 的别名，语义同样是 OFFSET |
| `list` | 否 | 条件对象，规则同 `more` 模式 |
| `sorts.name` | 否（传了 `sorts` 就必填） | 排序列名 |
| `sorts.val` | 否 | `'ASC'` / `'DESC'`（大小写均可），默认 `DESC` |

```js
const { sql, count } = xqsql.get('goods', {
    list: { name: '香蕉' },
    sorts: { name: 'create_time', val: 'DESC' },
    limits: { offset: 0, size: 10 },
}, 'page');
// sql:   SELECT * FROM `goods` WHERE `name` LIKE '%香蕉%' ORDER BY `create_time` DESC LIMIT 0, 10
// count: SELECT COUNT(*) FROM `goods` WHERE `name` LIKE '%香蕉%'
```

> 页码换算请自己算：`offset = (page - 1) * size`。`limits.page` 这个字段**不是页码**，保留它只是为了兼容 1.x 的写法。

### up — 更新

```js
up(table, params, fields, mode?) → string
```

`mode` 取值：`'one'`（默认）、`'more'`、`'all'`。

| 参数字段 | 说明 |
| --- | --- |
| `params.list` | 待更新数据，必填对象 |
| `params.key` | `one` / `more` 模式下的条件列名，必填 |
| `params.ids` | `one` 长度必须为 1，`more` 至少一个；`all` 忽略 |

- 只更新 `fields` 里声明过、且 `list` 中用 `hasOwnProperty` 存在的列。
- `list` 里值为 **`undefined` 表示「不更新这一列」**，`null` 会写入 `NULL`。
- 一条可更新的列都没有时抛 105（旧版会生成 `SET  WHERE` 这种非法 SQL）。

```js
xqsql.up('goods', { key: 'id', ids: [1, 2], list: { price: 9.9 } }, GOODS_FIELDS, 'more');
// UPDATE `goods` SET `price` = 9.9 WHERE `id` IN (1, 2)

xqsql.up('goods', { list: { number: 0 } }, GOODS_FIELDS, 'all');
// UPDATE `goods` SET `number` = 0
```

### del — 删除

```js
del(table, params?, mode?) → string
```

`mode` 取值：`'one'`（默认）、`'more'`、`'all'`。`'all'` 完全忽略 `params`，可以沿用旧写法 `del('goods', '', 'all')`。

```js
xqsql.del('goods', { key: 'id', ids: [1] });            // DELETE FROM `goods` WHERE `id` = 1
xqsql.del('goods', { key: 'id', ids: [1,2,3] }, 'more'); // DELETE FROM `goods` WHERE `id` IN (1, 2, 3)
xqsql.del('goods', '', 'all');                           // DELETE FROM `goods`
```

### create — 独立实例

`likeFields` 默认硬编码在库里，用 `create` 可以换掉，且实例之间互不影响。

```js
const sql = xqsql.create({ likeFields: ['title', 'content'] });

sql.get('goods', { title: 'x', name: 'y' }, 'more');
// SELECT * FROM `goods` WHERE `title` LIKE '%x%' AND `name` = 'y'
```

默认白名单：`['name', 'user', 'origin_name', 'url']`。

### XqSqlError

```js
try {
    xqsql.add('goods', [{ name: '' }], [{ name: '商品名称', value: 'name', isMust: true }]);
} catch (error) {
    error instanceof xqsql.XqSqlError; // true
    error.code;   // 101
    error.msg;    // 'save_fail'
    error.info;   // '请填写商品名称!'
    error.details;// { table: 'goods', field: 'name' }
    error.toJSON();// { code: 101, msg: 'save_fail', data: { info: '请填写商品名称!' } }
}
```

`toJSON()` 的返回结构与 1.x 里 `res.json({ code, msg, data: { info } })` 的响应体一致，Express 侧可以：

```js
try {
    const sql = xqsql.add('goods', rows, fields);
    res.json({ code: 100, msg: 'save_ok', data: { sql } });
} catch (error) {
    if (error instanceof xqsql.XqSqlError) return res.json(error.toJSON());
    throw error;
}
```

---

## 值编码规则

| JS 值 | 生成的 SQL | 备注 |
| --- | --- | --- |
| `'苹果'` | `'苹果'` | 单引号，非双引号 |
| `"o'brien"` | `'o\'brien'` | 单引号转义 |
| `'a\b'` | `'a\\b'` | 反斜杠先转义 |
| `'a\nb'` | `'a\nb'` | `\n` `\r` `\t` `\b` `\0` `\Z` 均转义 |
| `10` | `10` | 原样 |
| `8.8` | `8.8` | **不再被 `parseInt` 截断成 8** |
| `NaN` / `Infinity` | 抛 108 | 非有限数拒绝 |
| `9007199254740993n` | `9007199254740993` | bigint 用 `toString()` |
| `true` / `false` | `1` / `0` | MySQL 无布尔字面量 |
| `null` / `undefined` | `NULL` | 旧版会写成字符串 `"null"` |
| `new Date(2026,9,21,9,30,0)` | `'2026-10-21 09:30:00'` | 本地时区，DATETIME 格式 |
| 数组 / 普通对象 | 抛 108 | 拒绝静默 `[object Object]` |

标识符（表名、列名、条件键、排序字段）走白名单正则 `^[A-Za-z_][A-Za-z0-9_$]{0,63}$`，表名额外允许一段 `.schema`。不合规一律抛 102。

---

## 错误码

| code | msg | 触发场景 |
| --- | --- | --- |
| 101 | `save_fail` | `isMust: true` 的字段值为 `''` / `null` / `undefined` |
| 102 | `invalid_identifier` | 表名、列名、条件键、排序字段不合规；`sorts.name` 缺失 |
| 103 | `invalid_number` | `limits.size` / `limits.offset` 缺失或非非负整数 |
| 104 | `invalid_order` | `sorts.val` 不是 `ASC` / `DESC` |
| 105 | `empty_input` | `rows` / `fields` 为空；`up` 无可更新字段 |
| 106 | `invalid_ids` | `ids` 不是数组，或长度不满足模式要求 |
| 107 | `invalid_mode` | `mode` 或 `params.type` 取值未知 |
| 108 | `invalid_value` | 值类型不支持（对象、数组、`NaN`、无效 `Date`） |
| 109 | `invalid_argument` | `params` / `list` / `limits` / `sorts` 不是对象；`create` 的 options 非法 |

---

## 安全声明

2.0.0 做了这些加固：

- **值**：统一单引号 + 反斜杠转义，覆盖 `\` `'` `\0` `\n` `\r` `\t` `\b` `\Z`。
- **标识符**：表名、列名、条件键、排序字段全部走白名单正则，不合规直接抛错，不进 SQL。
- **排序方向**：只接受 `ASC` / `DESC`，输出统一大写。
- **LIMIT / OFFSET**：强制非负安全整数，纯数字字符串也会被校验。

**仍然存在的边界，请务必知悉：**

1. 本库输出的是**拼接好的 SQL 文本**，不提供 `?` 占位符与参数化绑定。安全加固能把意外输入挡住，但**不要让完全不可信的输入直接进 `likeFields` 之外的自由文本列**——真要做到彻底免疫，请用支持预编译的驱动（如 `mysql2` 的 `execute`）。
2. `LIKE` 条件中的 `%` 与 `_` 按通配符透传。如果你要让用户搜索字面量的 `%`，需要先自己转义。
3. 校验只针对注入，**不校验业务逻辑**。`del('goods', '', 'all')` 会真的生成全表删除语句。

---

## 迁移到 2.0.0

2.0.0 是破坏性版本。逐条对照：

| 旧行为（1.x） | 新行为（2.0.0） | 调用方怎么改 |
| --- | --- | --- |
| 字符串用双引号 `"苹果"` | 单引号 `'苹果'` | 无需改；若数据库开了 `ANSI_QUOTES`，现在反而能用了 |
| `price: 8.8` → `8` | `price: 8.8` → `8.8` | 检查是否有人依赖了被截断的值 |
| `add()` 自动插入 `id` 列并写 `(0, …)` | 不再注入 | 需要显式主键就把 `{ value: 'id' }` 加进 `fields`；依赖 MySQL 把 `0` 当自增触发器的逻辑必须改掉 |
| `up()` 必填为空 → `ReferenceError: res is not defined` | 抛 `XqSqlError(101)` | 用 `try/catch` + `instanceof xqsql.XqSqlError` 捕获 |
| `up(..., 'all')` 不传 `ids` → `TypeError` | 正常工作 | 无需改 |
| `del(..., 'one')` 不传 `ids` → `TypeError` | 抛 106 | 补 `ids`，或改 `del(table, '', 'all')` |
| `get({ type: 'one' })` 不传 `ids` → `TypeError` | 抛 106 | 补 `ids` |
| 未知 `type` → 返回 `undefined` | 抛 107 | 加 `try/catch` |
| `null` → 字符串 `"null"` | `NULL` | 若之前靠 `"null"` 命中过数据，需检查 |
| `up()` 里 `undefined` 会被写成 `"undefined"` | 跳过该列 | 想清空某列请显式传 `null` |
| `COUNT(id)` | `COUNT(*)` | 无需改 |
| 只有 `limits.page`（实为 offset） | 新增 `limits.offset` 为首选名 | 建议改用 `offset`，`page` 作为别名仍可用 |
| 无 | `exports` 收紧 | 深路径 import 只能用 `xqsql/lib/*` |

**最小迁移示例（Express）：**

```js
// 1.x
const sql = xqsql.add('goods', rows, fields); // 可能抛 ReferenceError

// 2.0.0
try {
    const sql = xqsql.add('goods', rows, fields);
    res.json({ code: 100, msg: 'save_ok', data: { sql } });
} catch (error) {
    if (error instanceof xqsql.XqSqlError) return res.json(error.toJSON());
    next(error);
}
```

---

## 本地测试页面

仓库内 `test/` 下有三个自查页面，会**真的在浏览器里跑用例**并把 PASS/FAIL 渲染出来，不是 console 打印：

```bash
npm run test:browser        # 启动本地服务，打开 http://127.0.0.1:8080/
npm run test:browser:check  # 用真实浏览器跑一遍三个页面并汇总结果
```

| 页面 | 验证的加载方式 |
| --- | --- |
| `test/index.html` | 索引页，链接到下面三页 |
| `test/browser.html` | UMD / 全局 `window.xqsql` |
| `test/esm.html` | `<script type="module">` 与默认 + 命名导出 |
| `test/amd.html` | AMD（`require.js` 固定 2.3.6，已放入 `test/vendor/`） |

页面结束时会在 `window` 上留下可用实例（`window.xqsql` / `window.__xqsqlEsm__` / `window.__xqsqlAmd__`），方便手动在控制台试语句。

---

## AI 元数据

发布包里带了两份给编码智能体读的入口文件（`llms.txt` 与 `SKILL.md`），运行时 API 完全没有变化：

| 字段 | 文件 | 作用 |
| --- | --- | --- |
| `llms` | `llms.txt` | 精简 API 面：四种引入方式、全部导出、关键选项、错误码、一个可直接抄的例子、硬约束 |
| `agents` | `skills/xqsql-sql-builder/SKILL.md` | 可移植 skill：入口选择、接入顺序、容易踩的坑、验收命令 |

`package.json` 里已声明这两个字段，`files` 也放行了 `llms.txt` 与 `skills/`，因此 `npm pack` 会带上它们：

```json
{
    "llms": "./llms.txt",
    "agents": "./skills/xqsql-sql-builder/SKILL.md",
    "files": ["lib", "llms.txt", "skills", "zh.md", "CHANGELOG.md"]
}
```

完整的签名、参数与值编码表在 `skills/xqsql-sql-builder/references/api.md`。`test/agent-metadata.test.mjs` 会逐字比对文档里的示例 SQL 与实际输出，并对导出名、错误码、frontmatter 和相对链接做校验，文档写错就构建失败。

---

## 开发

```bash
npm run build               # esbuild 重建 lib 下全部产物
npm test                    # 先构建，再跑 node --test 全部用例
npm run typecheck           # tsc --noEmit，校验 d.ts 与示例
npm run test:browser        # 起本地页面服务
npm run test:browser:check  # 真实浏览器验收
npm run verify              # 上述三者串起来
```

源码在 `src/`，**不要直接编辑 `lib/`**——`lib/xqsql*.js` 全部由 `scripts/build.mjs` 生成，`pretest` 会强制重建。

### 提交信息

`npm install` 通过 `prepare` → `husky` 注册 Git 钩子：`commit-msg` 走 commitlint（Conventional Commits），`pre-commit` 走 lint-staged（本项目不引入 linter，只做零依赖的 `node --check` 语法检查）。

```bash
git commit -m "fix(xqsql): 修复 LIKE 值中的引号转义"
```

可用类型：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`revert`、`chore`。发版前先升版本号（连同 `package-lock.json` 根版本），并让 `CHANGELOG.md` 出现对应版本标题。

---

## 许可证

MIT © gitguanqi
