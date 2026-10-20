import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const read = (file) => readFile(at(file), 'utf8');

const declaration = await read('lib/types/index.d.ts');

test('类型声明覆盖四个构造器与实例工厂', () => {
    for (const name of ['add', 'get', 'up', 'del']) {
        assert.match(declaration, new RegExp(`export declare const ${name}:`), name);
    }
    assert.match(declaration, /create: CreateFn/);
    assert.match(declaration, /export interface Xqsql \{/);
    assert.match(declaration, /export default xqsql;/);
});

test('XqSqlError 只作为类型导出，不伪装成运行时命名导出', () => {
    assert.match(declaration, /declare class XqSqlError extends Error/);
    assert.match(declaration, /export type \{ XqSqlError \}/);
    assert.doesNotMatch(declaration, /export declare class XqSqlError/);
    assert.match(declaration, /XqSqlError: typeof XqSqlError/);
});

test('get 的重载让 page 模式返回 { sql, count }', () => {
    assert.match(declaration, /mode: 'page'[^;]*PageResult/);
    assert.match(declaration, /mode: 'more'[^;]*string/);
    assert.match(declaration, /export interface PageResult \{\s*readonly sql: string;\s*readonly count: string;/);
});

test('声明的命名导出与运行时一致', async () => {
    const runtime = await import(pathToFileURL(at('lib/xqsql-esm.mjs')).href);
    const declared = [...declaration.matchAll(/export declare const (\w+):/g)].map((m) => m[1]);
    const runtimeNamed = Object.keys(runtime).filter((key) => key !== 'default').sort();

    assert.deepEqual(declared.sort(), runtimeNamed);
});

test('错误码在声明与实现中一致', async () => {
    const source = await read('src/error.js');
    for (const code of ['101', '102', '103', '104', '105', '106', '107', '108', '109']) {
        assert.ok(source.includes(`: ${code}`), `src/error.js 缺少错误码 ${code}`);
        assert.ok(declaration.includes(code), `index.d.ts 注释缺少错误码 ${code}`);
    }
});

test('类型夹具与 tsconfig 存在，供 tsc --noEmit 校验', async () => {
    await access(at('test/ts-fixture/usage.ts'));
    const fixture = await read('test/ts-fixture/usage.ts');
    for (const call of ['add(', 'get(', 'up(', 'del(', 'create(', 'toJSON()']) {
        assert.ok(fixture.includes(call), `夹具未覆盖 ${call}`);
    }

    const tsconfig = JSON.parse(await read('tsconfig.json'));
    assert.equal(tsconfig.compilerOptions.noEmit, true);
    assert.equal(tsconfig.compilerOptions.strict, true);
    assert.ok(tsconfig.include.includes('test/ts-fixture/**/*.ts'));
});
