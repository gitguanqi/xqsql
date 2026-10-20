import assert from 'node:assert/strict';
import test from 'node:test';

import xqsql, { add, get, up, del } from '../lib/xqsql-esm.mjs';

const { XqSqlError } = xqsql;

const GOODS_ROWS = [
    { name: '苹果', number: 10, price: 8.8 },
    { name: '蓝莓', number: 20, price: 9.9 },
];

const GOODS_FIELDS = [
    { name: '商品名称', value: 'name', isMust: true },
    { name: '商品数量', value: 'number', isMust: true },
    { name: '商品价格', value: 'price', isMust: true },
];

/** 断言抛出指定错误码，并顺带校验错误对象形状。 */
function expectCode(fn, code) {
    assert.throws(fn, (error) => {
        assert.ok(error instanceof XqSqlError, `应抛 XqSqlError，实际 ${error}`);
        assert.equal(error.code, code);
        assert.equal(typeof error.msg, 'string');
        return true;
    });
}

test('导出面：四个命名导出与默认导出指向同一批函数', () => {
    assert.equal(typeof xqsql.add, 'function');
    assert.equal(typeof xqsql.get, 'function');
    assert.equal(typeof xqsql.up, 'function');
    assert.equal(typeof xqsql.del, 'function');
    assert.equal(add, xqsql.add);
    assert.equal(get, xqsql.get);
    assert.equal(up, xqsql.up);
    assert.equal(del, xqsql.del);
    assert.equal(typeof xqsql.create, 'function');
    assert.equal(typeof xqsql.XqSqlError, 'function');
    assert.ok(new XqSqlError(101, 'x') instanceof Error);
});

test('add：多行插入使用单引号并保留小数', () => {
    assert.equal(
        add('goods', GOODS_ROWS, GOODS_FIELDS),
        "INSERT INTO `goods` (`name`, `number`, `price`) VALUES ('苹果', 10, 8.8), ('蓝莓', 20, 9.9)",
    );
});

test('add：列顺序严格跟 fields 一致', () => {
    assert.equal(
        add('goods', [{ price: 1, name: 'x' }], [{ value: 'price' }, { value: 'name' }]),
        "INSERT INTO `goods` (`price`, `name`) VALUES (1, 'x')",
    );
});

test('add：字符串按 MySQL 规则转义', () => {
    assert.equal(
        add('t', [{ s: "o'brien" }], [{ value: 's' }]),
        "INSERT INTO `t` (`s`) VALUES ('o\\'brien')",
    );
    assert.equal(
        add('t', [{ s: 'a\\b' }], [{ value: 's' }]),
        "INSERT INTO `t` (`s`) VALUES ('a\\\\b')",
    );
    assert.equal(
        add('t', [{ s: 'a\nb\rc\td' }], [{ value: 's' }]),
        "INSERT INTO `t` (`s`) VALUES ('a\\nb\\rc\\td')",
    );
});

test('add：null/boolean/Date 编码为合法字面量', () => {
    assert.equal(
        add('t', [{ a: null, b: true, c: false, d: new Date(2026, 9, 21, 9, 30, 0) }], [
            { value: 'a' }, { value: 'b' }, { value: 'c' }, { value: 'd' },
        ]),
        "INSERT INTO `t` (`a`, `b`, `c`, `d`) VALUES (NULL, 1, 0, '2026-10-21 09:30:00')",
    );
});

test('add：缺失字段写成 NULL', () => {
    assert.equal(
        add('t', [{ a: 1 }], [{ value: 'a' }, { value: 'b' }]),
        'INSERT INTO `t` (`a`, `b`) VALUES (1, NULL)',
    );
});

test('add：isMust 为空抛 101，info 用中文字段名', () => {
    assert.throws(
        () => add('goods', [{ name: '' }], GOODS_FIELDS),
        (error) => {
            assert.equal(error.code, 101);
            assert.equal(error.msg, 'save_fail');
            assert.equal(error.info, '请填写商品名称!');
            assert.deepEqual(error.toJSON(), {
                code: 101,
                msg: 'save_fail',
                data: { info: '请填写商品名称!' },
            });
            return true;
        },
    );
    expectCode(() => add('goods', [{}], GOODS_FIELDS), 101);
});

test('add：空输入与非法标识符', () => {
    expectCode(() => add('goods', [], GOODS_FIELDS), 105);
    expectCode(() => add('goods', GOODS_ROWS, []), 105);
    expectCode(() => add('goods`; DROP TABLE x; --', GOODS_ROWS, GOODS_FIELDS), 102);
    expectCode(() => add('goods', [{ a: 1 }], [{ value: 'a` = 1 -- ' }]), 102);
    expectCode(() => add('goods', [{ a: 1 }], [{ value: '' }]), 102);
    expectCode(() => add('goods', { name: 'x' }, GOODS_FIELDS), 105);
});

test('add：不支持的值类型抛 108', () => {
    expectCode(() => add('t', [{ a: { b: 1 } }], [{ value: 'a' }]), 108);
    expectCode(() => add('t', [{ a: [1, 2] }], [{ value: 'a' }]), 108);
    expectCode(() => add('t', [{ a: NaN }], [{ value: 'a' }]), 108);
    expectCode(() => add('t', [{ a: Infinity }], [{ value: 'a' }]), 108);
    expectCode(() => add('t', [{ a: new Date('nope') }], [{ value: 'a' }]), 108);
});

test('get default：one / more / all 三个分支', () => {
    assert.equal(
        get('goods', { type: 'one', key: 'id', ids: [1] }, 'default', 'id,name'),
        'SELECT `id`, `name` FROM `goods` WHERE `id` = 1',
    );
    assert.equal(
        get('goods', { type: 'one', key: 'code', ids: ['a'] }),
        "SELECT * FROM `goods` WHERE `code` = 'a'",
    );
    assert.equal(
        get('goods', { type: 'more', key: 'id', ids: [1, 2, 3] }, 'default', 'id,name'),
        'SELECT `id`, `name` FROM `goods` WHERE `id` IN (1, 2, 3)',
    );
    assert.equal(
        get('goods', { type: 'all' }, 'default', 'id,name'),
        'SELECT `id`, `name` FROM `goods`',
    );
    assert.equal(get('shop.goods', { type: 'all' }), 'SELECT * FROM `shop`.`goods`');
});

test('get default：字段列表支持数组与星号', () => {
    assert.equal(get('goods', { type: 'all' }, 'default', ['id', 'name']), 'SELECT `id`, `name` FROM `goods`');
    assert.equal(get('goods', { type: 'all' }, 'default', '*'), 'SELECT * FROM `goods`');
    assert.equal(get('goods', { type: 'all' }, 'default'), 'SELECT * FROM `goods`');
    expectCode(() => get('goods', { type: 'all' }, 'default', 'id,na`me'), 102);
});

test('get default：非法 type 与 ids 抛错，不再返回 undefined', () => {
    expectCode(() => get('goods', { type: 'xx', key: 'id', ids: [1] }), 107);
    expectCode(() => get('goods', {}), 107);
    expectCode(() => get('goods', { type: 'one', key: 'id' }), 106);
    expectCode(() => get('goods', { type: 'one', key: 'id', ids: [1, 2] }), 106);
    expectCode(() => get('goods', { type: 'more', key: 'id', ids: [] }), 106);
    expectCode(() => get('goods', { type: 'one', key: 'id`x', ids: [1] }), 102);
});

test('get more：LIKE 白名单与条件拼接', () => {
    assert.equal(
        get('goods', { id: 1, name: '香蕉' }, 'more', 'id,name'),
        "SELECT `id`, `name` FROM `goods` WHERE `id` = 1 AND `name` LIKE '%香蕉%'",
    );
});

test('get more：0 与 false 保留，空串与 null 跳过', () => {
    assert.equal(
        get('goods', { id: 0, ok: false, name: '', memo: null }, 'more'),
        'SELECT * FROM `goods` WHERE `id` = 0 AND `ok` = 0',
    );
});

test('get more：无有效条件时省略 WHERE', () => {
    assert.equal(get('goods', {}, 'more'), 'SELECT * FROM `goods`');
    assert.equal(get('goods', { name: '' }, 'more'), 'SELECT * FROM `goods`');
    expectCode(() => get('goods', null, 'more'), 109);
});

test('get more：likeFields 可配置且实例隔离', () => {
    const custom = xqsql.create({ likeFields: ['title'] });
    assert.equal(
        custom.get('t', { title: 'x', name: 'y' }, 'more'),
        "SELECT * FROM `t` WHERE `title` LIKE '%x%' AND `name` = 'y'",
    );
    assert.equal(
        xqsql.get('t', { title: 'x' }, 'more'),
        "SELECT * FROM `t` WHERE `title` = 'x'",
    );
    expectCode(() => xqsql.create({ likeFields: 'title' }), 109);
    expectCode(() => xqsql.create(1), 109);
});

test('get more：条件键与值都不能注入', () => {
    expectCode(() => get('goods', { 'id` = 1 -- ': 1 }, 'more'), 102);
    const sql = get('goods', { name: "a'; DROP TABLE t-- " }, 'more');
    assert.equal(sql, "SELECT * FROM `goods` WHERE `name` LIKE '%a\\'; DROP TABLE t-- %'");
    assert.ok(sql.includes("\\'"));
    assert.ok(!sql.includes("'a';"));
});

test('get more：只遍历自有属性，不碰原型链', () => {
    const params = Object.create({ evil: 1 });
    params.id = 2;
    assert.equal(get('goods', params, 'more'), 'SELECT * FROM `goods` WHERE `id` = 2');
});

test('get page：sql 与 count 成对返回', () => {
    assert.deepEqual(
        get('goods', {
            list: { name: '香蕉' },
            sorts: { name: 'create_time', val: 'DESC' },
            limits: { offset: 0, size: 10 },
        }, 'page'),
        {
            sql: "SELECT * FROM `goods` WHERE `name` LIKE '%香蕉%' ORDER BY `create_time` DESC LIMIT 0, 10",
            count: "SELECT COUNT(*) FROM `goods` WHERE `name` LIKE '%香蕉%'",
        },
    );
});

test('get page：sorts 可选，缺失时不输出 ORDER BY', () => {
    assert.equal(get('goods', { limits: { size: 10 } }, 'page').sql, 'SELECT * FROM `goods` LIMIT 0, 10');
    assert.equal(get('goods', { limits: { offset: 5, size: 20 } }, 'page').sql, 'SELECT * FROM `goods` LIMIT 5, 20');
});

test('get page：排序方向大小写归一，方向非法抛 104', () => {
    const sql = get('goods', { sorts: { name: 'id', val: 'asc' }, limits: { size: 1 } }, 'page').sql;
    assert.equal(sql, 'SELECT * FROM `goods` ORDER BY `id` ASC LIMIT 0, 1');
    expectCode(() => get('goods', { sorts: { name: 'id', val: 'DESC; DROP TABLE t' }, limits: { size: 1 } }, 'page'), 104);
    expectCode(() => get('goods', { sorts: { name: 'id`x', val: 'ASC' }, limits: { size: 1 } }, 'page'), 102);
    expectCode(() => get('goods', { sorts: { val: 'ASC' }, limits: { size: 1 } }, 'page'), 102);
});

test('get page：limits 只接受非负整数，page 是 offset 的等价别名', () => {
    assert.equal(get('goods', { limits: { page: 10, size: 5 } }, 'page').sql, 'SELECT * FROM `goods` LIMIT 10, 5');
    assert.equal(get('goods', { limits: { size: '10' } }, 'page').sql, 'SELECT * FROM `goods` LIMIT 0, 10');
    expectCode(() => get('goods', { limits: { size: -1 } }, 'page'), 103);
    expectCode(() => get('goods', { limits: { size: 10.5 } }, 'page'), 103);
    expectCode(() => get('goods', { limits: { size: '10abc' } }, 'page'), 103);
    expectCode(() => get('goods', { limits: { page: '0 or 1=1', size: 10 } }, 'page'), 103);
    expectCode(() => get('goods', { limits: {} }, 'page'), 103);
    expectCode(() => get('goods', {}, 'page'), 109);
    expectCode(() => get('goods', { limits: { size: 1 }, list: 'x' }, 'page'), 109);
});

test('get：未知 mode 抛 107', () => {
    expectCode(() => get('goods', {}, 'paged'), 107);
    expectCode(() => get('goods', {}, ''), 107);
});

test('up：单条 / 多条 / 全部三种模式', () => {
    const fields = [{ name: '商品数量', value: 'number' }, { name: '商品价格', value: 'price' }];
    const base = { key: 'id', list: { number: 10, price: 9.9 } };
    assert.equal(
        up('goods', { ...base, ids: [1] }, fields),
        'UPDATE `goods` SET `number` = 10, `price` = 9.9 WHERE `id` = 1',
    );
    assert.equal(
        up('goods', { ...base, ids: [1, 2, 3] }, fields, 'more'),
        'UPDATE `goods` SET `number` = 10, `price` = 9.9 WHERE `id` IN (1, 2, 3)',
    );
    assert.equal(
        up('goods', base, fields, 'all'),
        'UPDATE `goods` SET `number` = 10, `price` = 9.9',
    );
});

test('up：null 写 NULL，undefined 表示不更新，空串照写', () => {
    assert.equal(
        up('goods', { key: 'id', ids: [1], list: { a: null, b: undefined, c: '' } }, [
            { value: 'a' }, { value: 'b' }, { value: 'c' },
        ]),
        "UPDATE `goods` SET `a` = NULL, `c` = '' WHERE `id` = 1",
    );
});

test('up：必填为空抛 101，可更新字段为空抛 105', () => {
    expectCode(
        () => up('goods', { key: 'id', ids: [1], list: { price: '' } }, [{ name: '商品价格', value: 'price', isMust: true }]),
        101,
    );
    expectCode(() => up('goods', { key: 'id', ids: [1], list: {} }, [{ value: 'price' }]), 105);
    expectCode(() => up('goods', { key: 'id', ids: [1], list: { a: 1 } }, []), 105);
    expectCode(() => up('goods', { key: 'id', ids: [1], list: { a: 1 } }, [{ value: 'b' }]), 105);
});

test('up：ids 缺失或数量不符抛 106', () => {
    const fields = [{ value: 'price' }];
    expectCode(() => up('goods', { key: 'id', list: { price: 1 } }, fields), 106);
    expectCode(() => up('goods', { key: 'id', ids: [1, 2], list: { price: 1 } }, fields), 106);
    expectCode(() => up('goods', { key: 'id', ids: [], list: { price: 1 } }, fields, 'more'), 106);
    expectCode(() => up('goods', { key: 'id', ids: [1], list: { price: 1 } }, fields, 'some'), 107);
    expectCode(() => up('goods', { key: 'id', ids: [1] }, fields), 109);
});

test('del：单条 / 多条 / 全部，all 模式忽略 params', () => {
    assert.equal(del('goods', { key: 'id', ids: [1] }), 'DELETE FROM `goods` WHERE `id` = 1');
    assert.equal(del('goods', { key: 'id', ids: [1, 2, 3] }, 'more'), 'DELETE FROM `goods` WHERE `id` IN (1, 2, 3)');
    assert.equal(del('goods', '', 'all'), 'DELETE FROM `goods`');
    assert.equal(del('goods', undefined, 'all'), 'DELETE FROM `goods`');
});

test('del：ids 缺失、数量不符与未知模式', () => {
    expectCode(() => del('goods', { key: 'id' }), 106);
    expectCode(() => del('goods', { key: 'id', ids: [1, 2] }), 106);
    expectCode(() => del('goods', { key: 'id', ids: [] }, 'more'), 106);
    expectCode(() => del('goods', { key: 'id', ids: [1] }, 'none'), 107);
    expectCode(() => del('goods', null), 109);
    expectCode(() => del('goods`x', { key: 'id', ids: [1] }), 102);
});

test('调用不会修改传入对象', () => {
    const params = { key: 'id', ids: [1], list: { price: 9.9 } };
    const snapshot = JSON.parse(JSON.stringify(params));
    up('goods', params, [{ value: 'price' }]);
    assert.deepEqual(params, snapshot);

    const rows = [{ a: 'x' }];
    add('t', rows, [{ value: 'a' }]);
    assert.deepEqual(rows, [{ a: 'x' }]);
});

test('错误对象结构稳定，可直接映射为 HTTP 响应', () => {
    const error = new XqSqlError(102, '非法的表名: x');
    assert.equal(error.name, 'XqSqlError');
    assert.equal(error.msg, 'invalid_identifier');
    assert.deepEqual(error.toJSON(), {
        code: 102,
        msg: 'invalid_identifier',
        data: { info: '非法的表名: x' },
    });
});
