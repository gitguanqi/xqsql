import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const read = (file) => readFile(at(file), 'utf8');

const PAGES = ['browser.html', 'esm.html', 'amd.html'];

test('索引页链接到每一条消费路径', async () => {
    const html = await read('test/index.html');
    for (const page of PAGES) {
        assert.match(html, new RegExp(`href="\\./${page.replace('.', '\\.')}"`), page);
    }
    assert.match(html, /UMD/);
    assert.match(html, /ESM/);
    assert.match(html, /AMD/);
});

test('每个页面共用外壳与可见断言列表', async () => {
    for (const page of PAGES) {
        const html = await read(`test/${page}`);
        assert.match(html, /<link rel="icon" href="\.\/icon\.svg" type="image\/svg\+xml">/, page);
        assert.match(html, /<img[^>]+src="\.\/icon\.svg"/, page);
        assert.match(html, /href="\.\/demo\.css"/, page);
        assert.match(html, /role="status" aria-live="polite"/, page);
        assert.match(html, /id="summary"/, page);
        assert.match(html, /id="checks"/, page);
        assert.match(html, /id="results"/, page);
        assert.match(html, /id="details"/, page);
    }
});

test('所有页面都不依赖外网脚本', async () => {
    for (const file of ['test/index.html', ...PAGES.map((page) => `test/${page}`)]) {
        const html = await read(file);
        assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//, file);
        assert.doesNotMatch(html, /cdn\.bootcdn\.net|unpkg\.com|cdn\.jsdelivr\.net/, file);
    }
});

test('UMD 页面只加载压缩后的浏览器产物', async () => {
    const html = await read('test/browser.html');
    assert.match(html, /<script src="\.\.\/lib\/xqsql\.min\.js"><\/script>/);
    assert.match(html, /src="\.\/browser-checks\.js"/);
    assert.doesNotMatch(html, /xqsql-esm/);
});

test('ESM 页面同时验证默认导出与命名导出', async () => {
    const html = await read('test/esm.html');
    assert.match(html, /<script type="module" src="\.\/esm-checks\.js"><\/script>/);
    assert.doesNotMatch(html, /<script src="\.\.\/lib\/xqsql\.min\.js">/);

    const checks = await read('test/esm-checks.js');
    assert.match(checks, /import xqsql, \{ add, del, get, up \} from '\.\.\/lib\/xqsql-esm\.min\.js';/);
    assert.match(checks, /xqsql\.add === add/);
});

test('AMD 页面使用本地固定版本 require.js', async () => {
    const html = await read('test/amd.html');
    assert.match(html, /<script src="\.\/vendor\/require-2\.3\.6\.min\.js"><\/script>/);
    assert.match(html, /requirejs\(\['\.\/amd-checks'\]/);
    assert.match(html, /xqsql: '\.\.\/lib\/xqsql\.min'/);

    const vendor = await read('test/vendor/require-2.3.6.min.js');
    assert.ok(vendor.length > 10000);
    assert.match(vendor, /requirejs/);

    const license = await read('test/vendor/LICENSE-REQUIREJS-2.3.6');
    assert.match(license, /RequireJS 2\.3\.6/);
    assert.match(license, /MIT/);
});

test('共享断言脚本暴露机读状态并渲染结果面板', async () => {
    const checks = await read('test/checks.js');
    assert.match(checks, /root\.XqChecks = \{/);
    assert.match(checks, /__XQSQL_TEST__/);
    assert.match(checks, /__XQSQL_DEMO__/);
    assert.match(checks, /'is-pass' : 'is-fail'/);
    assert.match(checks, /getElementById\('results'\)/);
    assert.match(checks, /status: ok \? 'passed' : 'failed'/);

    const cases = await read('test/core-checks.js');
    assert.match(cases, /root\.xqsqlCases = \[/);
    assert.doesNotMatch(cases, /^\s*(import|export)\s/m);
});

test('三个薄壳都跑同一套用例并以 finish 收尾', async () => {
    for (const [file, label] of [
        ['test/browser-checks.js', 'UMD'],
        ['test/esm-checks.js', 'ESM'],
        ['test/amd-checks.js', 'AMD'],
    ]) {
        const source = await read(file);
        assert.match(source, /checks\.runCases\(/, file);
        assert.match(source, new RegExp(`checks\\.finish\\([^)]*'${label}'\\)`), file);
    }
});

test('用例覆盖四个构造器与关键错误码', async () => {
    const cases = await read('test/core-checks.js');
    for (const call of ['api.add(', 'api.get(', 'api.up(', 'api.del(', 'api.create(']) {
        assert.ok(cases.includes(call), `用例缺少 ${call}`);
    }
    for (const code of ['101:save_fail', '104:invalid_order', '107:invalid_mode']) {
        assert.ok(cases.includes(code), `用例缺少错误码 ${code}`);
    }
});

test('页面所需静态资源齐全', async () => {
    for (const file of ['test/icon.svg', 'test/demo.css', 'test/index.html', 'test/checks.js', 'test/core-checks.js']) {
        await access(at(file));
    }
    const icon = await read('test/icon.svg');
    assert.match(icon, /<svg /);
});
