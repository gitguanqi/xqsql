import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const require = createRequire(import.meta.url);
const read = (file) => readFile(at(file), 'utf8');
const loadEsm = (file) => import(pathToFileURL(at(file)).href);

/** 六个产物各自跑同一组场景，输出必须一致。 */
const SCENARIOS = [
    ['add', (api) => api.add('goods', [{ name: '苹果', number: 10, price: 8.8 }], [
        { name: '商品名称', value: 'name', isMust: true },
        { name: '商品数量', value: 'number' },
        { name: '商品价格', value: 'price' },
    ])],
    ['add 转义', (api) => api.add('t', [{ s: "o'brien\\x" }], [{ value: 's' }])],
    ['get one', (api) => api.get('goods', { type: 'one', key: 'id', ids: [1] }, 'default', 'id,name')],
    ['get more', (api) => api.get('goods', { id: 0, name: '香蕉' }, 'more')],
    ['get page', (api) => api.get('goods', {
        list: { name: '香蕉' },
        sorts: { name: 'create_time', val: 'desc' },
        limits: { offset: 0, size: 10 },
    }, 'page')],
    ['up', (api) => api.up('goods', { key: 'id', ids: [1], list: { price: 9.9, memo: null } }, [
        { value: 'price' }, { value: 'memo' },
    ])],
    ['del', (api) => api.del('goods', { key: 'id', ids: [1, 2, 3] }, 'more')],
    ['错误码', (api) => {
        try {
            api.get('goods', { type: 'xx' });
            return 'no-throw';
        } catch (error) {
            return `${error.name}:${error.code}:${error.msg}`;
        }
    }],
];

function runAll(api) {
    return SCENARIOS.map(([name, run]) => {
        try {
            return [name, run(api)];
        } catch (error) {
            return [name, `${error.name}:${error.code}:${error.msg}`];
        }
    });
}

test('两个 UMD 产物都是对象，并且不含已修复的旧缺陷', async () => {
    for (const file of ['lib/xqsql.js', 'lib/xqsql.min.js']) {
        const api = require(at(file));
        assert.equal(typeof api.add, 'function', file);
        assert.equal(typeof api.get, 'function', file);
        assert.equal(typeof api.up, 'function', file);
        assert.equal(typeof api.del, 'function', file);
        assert.equal(typeof api.create, 'function', file);
        assert.equal(typeof api.XqSqlError, 'function', file);

        const source = await read(file);
        // 注释里提到 res.json 是迁移说明，真正的判定是不能再有这行调用。
        assert.ok(!/res\.json\s*\(/.test(source), `${file} 不应再调用 res.json`);
        assert.ok(!source.includes('parseInt('), `${file} 不应再用 parseInt 截断`);
    }
});

test('UMD 外壳使用 self 回退与 define(factory)，不再立即求值', async () => {
    for (const file of ['lib/xqsql.js', 'lib/xqsql.min.js']) {
        const source = await read(file);
        assert.ok(source.includes("typeof self !== 'undefined' ? self : this"), file);
        assert.ok(source.includes('define(factory)'), file);
        assert.ok(!source.includes('define(factory())'), file);
        assert.ok(source.includes('root.xqsql = factory()'), file);
    }
});

test('UMD 在无 module/define 的环境里挂到全局 xqsql', async () => {
    const sandbox = vm.createContext({ self: {} });
    vm.runInContext(await read('lib/xqsql.min.js'), sandbox);
    assert.equal(typeof sandbox.self.xqsql.add, 'function');
    assert.equal(
        sandbox.self.xqsql.get('goods', { type: 'all' }),
        'SELECT * FROM `goods`',
    );
});

test('UMD 通过 AMD 注册时拿到 API 对象', async () => {
    let registered = null;
    const define = (factory) => {
        registered = factory();
    };
    define.amd = {};
    const sandbox = vm.createContext({ define });
    vm.runInContext(await read('lib/xqsql.min.js'), sandbox);
    assert.equal(typeof registered.add, 'function');
    assert.equal(registered.del('goods', { key: 'id', ids: [1] }), 'DELETE FROM `goods` WHERE `id` = 1');
});

test('ESM 的默认导出与命名导出是同一批函数', async () => {
    for (const file of ['lib/xqsql-esm.mjs', 'lib/xqsql-esm.min.mjs']) {
        const module = await loadEsm(file);
        assert.equal(module.default.add, module.add, file);
        assert.equal(module.default.get, module.get, file);
        assert.equal(module.default.up, module.up, file);
        assert.equal(module.default.del, module.del, file);
        assert.equal(typeof module.default.create, 'function', file);
        assert.equal(typeof module.default.XqSqlError, 'function', file);
    }
});

test('.mjs 镜像与 .js 逐字节相同', async () => {
    for (const [js, mjs] of [
        ['lib/xqsql-esm.js', 'lib/xqsql-esm.mjs'],
        ['lib/xqsql-esm.min.js', 'lib/xqsql-esm.min.mjs'],
    ]) {
        assert.equal(await read(js), await read(mjs), `${js} 与 ${mjs} 应完全一致`);
    }
});

test('四个入口的行为逐条一致', async () => {
    const apis = [
        ['cjs', require(at('lib/xqsql.js'))],
        ['cjs-min', require(at('lib/xqsql.min.js'))],
        ['esm', (await loadEsm('lib/xqsql-esm.mjs')).default],
        ['esm-min', (await loadEsm('lib/xqsql-esm.min.mjs')).default],
    ];

    const baseline = runAll(apis[0][1]);
    for (const [name, api] of apis.slice(1)) {
        assert.deepEqual(runAll(api), baseline, `${name} 与 cjs 输出不一致`);
    }

    // 至少确认黄金输出本身没跑偏
    assert.equal(baseline[0][1], "INSERT INTO `goods` (`name`, `number`, `price`) VALUES ('苹果', 10, 8.8)");
    assert.equal(baseline[4][1].sql, "SELECT * FROM `goods` WHERE `name` LIKE '%香蕉%' ORDER BY `create_time` DESC LIMIT 0, 10");
});

test('产物头部保留版本标记', async () => {
    for (const file of ['lib/xqsql.js', 'lib/xqsql.min.js', 'lib/xqsql-esm.mjs']) {
        assert.match(await read(file), /^\/\*! xqsql v2\.0\.0 \| MIT \| generated by scripts\/build\.mjs/);
    }
});
