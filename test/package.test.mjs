import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(at('package.json'), 'utf8'));

test('入口字段覆盖 CJS、ESM、浏览器与类型', () => {
    assert.equal(pkg.name, 'xqsql');
    assert.equal(pkg.version, '2.0.1');
    assert.equal(pkg.main, 'lib/xqsql.js');
    assert.equal(pkg.module, 'lib/xqsql-esm.mjs');
    assert.equal(pkg.browser, 'lib/xqsql.min.js');
    assert.equal(pkg.unpkg, 'lib/xqsql.min.js');
    assert.equal(pkg.jsdelivr, 'lib/xqsql.min.js');
    assert.equal(pkg.types, 'lib/types/index.d.ts');
    assert.equal(pkg.sideEffects, false);
});

test('exports 映射到实际存在的文件', () => {
    assert.equal(pkg.exports['.'].types, './lib/types/index.d.ts');
    assert.equal(pkg.exports['.'].import, './lib/xqsql-esm.mjs');
    assert.equal(pkg.exports['.'].require, './lib/xqsql.js');
    assert.equal(pkg.exports['.'].default, './lib/xqsql.js');
    assert.equal(pkg.exports['./lib/*'], './lib/*');
    assert.equal(pkg.exports['./package.json'], './package.json');
});

test('发布的每个文件都在磁盘上', async () => {
    const files = [
        pkg.main,
        pkg.module,
        pkg.browser,
        'lib/xqsql.min.js',
        'lib/xqsql-esm.js',
        'lib/xqsql-esm.min.js',
        'lib/xqsql-esm.min.mjs',
        'lib/types/index.d.ts',
        'llms.txt',
        'zh.md',
        'CHANGELOG.md',
    ];
    await Promise.all(files.map((file) => access(at(file))));
});

test('package.json 的 files 只发布 lib、Agent 元数据与文档', () => {
    assert.deepEqual(pkg.files, ['lib', 'llms.txt', 'skills', 'zh.md', 'CHANGELOG.md']);
    assert.ok(!pkg.files.includes('test'));
    assert.ok(!pkg.files.includes('scripts'));
    assert.ok(!pkg.files.includes('src'));
});

test('包自引用：require 与 import 都能拿到 API', async () => {
    const cjs = require('xqsql');
    assert.equal(typeof cjs.add, 'function');
    assert.equal(cjs.get('goods', { type: 'all' }), 'SELECT * FROM `goods`');

    const esm = await import('xqsql');
    assert.equal(typeof esm.default.add, 'function');
    assert.equal(esm.add, esm.default.add);
    assert.equal(esm.get('goods', { type: 'all' }), 'SELECT * FROM `goods`');
});

test('深路径仍然可用，供 CDN 与既有文档使用', () => {
    const scriptTag = require('xqsql/lib/xqsql.min.js');
    assert.equal(typeof scriptTag.add, 'function');
    assert.equal(scriptTag.del('goods', { key: 'id', ids: [1] }), 'DELETE FROM `goods` WHERE `id` = 1');
});

test('脚本覆盖构建、测试、类型与浏览器验收', () => {
    assert.match(pkg.scripts.build, /scripts\/build\.mjs/);
    assert.match(pkg.scripts.pretest, /build/);
    assert.match(pkg.scripts.test, /xqsql\.test\.mjs/);
    assert.match(pkg.scripts.test, /consistency\.test\.mjs/);
    assert.match(pkg.scripts.test, /package\.test\.mjs/);
    assert.match(pkg.scripts.test, /types\.test\.mjs/);
    assert.match(pkg.scripts.test, /agent-metadata\.test\.mjs/);
    assert.match(pkg.scripts.test, /browser-pages\.test\.mjs/);
    assert.match(pkg.scripts.test, /server\.test\.mjs/);
    assert.equal(pkg.scripts.typecheck, 'tsc --noEmit');
    assert.equal(pkg.scripts['test:browser'], 'node scripts/serve.mjs');
    assert.equal(pkg.scripts['test:browser:check'], 'node scripts/test-browser.mjs');
    assert.match(pkg.scripts.verify, /typecheck/);
    assert.match(pkg.scripts.prepublishOnly, /build/);
});

test('运行时零依赖，开发依赖只有构建与提交工具链', () => {
    assert.equal(pkg.dependencies, undefined);
    assert.deepEqual(Object.keys(pkg.devDependencies).sort(), [
        '@commitlint/cli',
        '@commitlint/config-conventional',
        'esbuild',
        'husky',
        'lint-staged',
        'typescript',
    ]);
});

test('提交校验链路完整：commit-msg 走 commitlint，pre-commit 走 lint-staged', async () => {
    assert.equal(pkg.scripts.prepare, 'husky');
    assert.equal(pkg.scripts.commitlint, 'commitlint --edit');
    await access(at('commitlint.config.mjs'));
    await access(at('lint-staged.config.mjs'));
    assert.match(await readFile(at('.husky/commit-msg'), 'utf8'), /commitlint --edit "\$1"/);
    assert.match(await readFile(at('.husky/pre-commit'), 'utf8'), /npx --no-install lint-staged/);
});
