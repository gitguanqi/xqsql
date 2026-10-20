# Changelog

本文件记录 xqsql 的用户可见变更。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [2.0.0] - 2026-10-21

### Breaking Changes

从 1.x 升级前请先读 README 的「迁移到 2.0.0」一节，重点如下：

- 字符串字面量由双引号 `"x"` 改为单引号 `'x'`，并按 MySQL 规则转义 `\` 与 `'`。
- 数字不再经过 `parseInt`，`8.8` 会写成 `8.8` 而不是 `8`。
- `add()` 不再自动注入 `id` 列与 `(0, …)`；需要显式主键时把 `{ value: 'id' }` 放进 `fields`。
- 必填校验失败改为抛 `XqSqlError`（code 101），不再引用宿主 `res` 对象。
- `ids` 缺失、模式未知不再崩溃或返回 `undefined`，统一抛带 `code` 的错误。
- `null` 写成 `NULL`（旧版是字符串 `"null"`）；`up()` 中 `undefined` 表示「不更新」，`null` 会写入 `NULL`。
- 统计语句由 `COUNT(id)` 改为 `COUNT(*)`；SQL 关键字统一大写（`IN`、`ORDER BY`）。
- `limits.page` 保留为 offset 的等价别名，新增 `limits.offset` 为首选名。
- `exports` 收紧，深路径只保留 `./lib/*` 与 `./package.json`。

### Added

- `xqsql.create({ likeFields })`：LIKE 列白名单可配置，实例之间互不影响。
- `XqSqlError`：`code` / `msg` / `info` / `details` / `toJSON()`，可直接映射为 HTTP 响应体。
- `lib/types/index.d.ts` 类型声明，含 `get(..., 'page')` 返回 `{ sql, count }` 的重载。
- `lib/xqsql-esm.mjs` 与 `lib/xqsql-esm.min.mjs` 镜像，使 Node 能直接 `import`。
- `src/` 单一源码 + `scripts/build.mjs`（esbuild）全量重建产物，`pretest` 强制重新构建。
- 零依赖测试服务器 `scripts/serve.mjs` 与浏览器验收脚本 `scripts/test-browser.mjs`。
- 自查式测试页面（UMD / ESM / AMD + 索引），共用一套用例并输出可见 PASS/FAIL。

### Changed

- 发布内容收敛为 `lib/`、`zh.md`、`CHANGELOG.md`，不再携带 `test/` 与 `deploy.sh`。
- 四个旧产物路径保持不变，CDN 与既有文档引用无需改动。
- 字段列表支持数组与 `'*'`，表名支持 `schema.table`。

### Fixed

- `up()` 必填为空时抛出 `ReferenceError: res is not defined`。
- `up(..., 'all')`、`del(..., 'one')`、`get(type: 'one')` 缺少 `ids` 时的 `TypeError`。
- 未知 `type` 返回 `undefined`，把错误延迟到调用方拼 SQL 时才炸。
- 空条件生成 `WHERE `、`SET  WHERE`、`id in ()`、`VALUES ` 等非法 SQL。
- `sorts.val`、`limits.page`、表名、字段名、字符串值五处 SQL 注入面。
- `Object.keys` 替代 `for...in`，不再遍历原型链。

### Security

- 值统一转义；标识符走白名单正则；LIMIT/OFFSET 强制非负整数；ORDER 方向限定 `ASC`/`DESC`。
- 仍需注意：本库输出拼接好的 SQL 文本，不提供参数化绑定；`LIKE` 的 `%`/`_` 按通配符透传。

## [1.0.3] - 2025-02-02

### Added

- 首个可安装版本：`add` / `get` / `up` / `del` 四个语句构造器，UMD 与 ESM 两种产物。
