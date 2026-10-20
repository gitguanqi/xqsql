/* 三个页面共用同一套用例：UMD / ESM / AMD 只是加载方式不同，断言必须完全一致。 */
(function (root) {
    'use strict';

    var GOODS = [
        { name: '苹果', number: 10, price: 8.8 },
        { name: '蓝莓', number: 20, price: 9.9 },
    ];

    var FIELDS = [
        { name: '商品名称', value: 'name', isMust: true },
        { name: '商品数量', value: 'number' },
        { name: '商品价格', value: 'price' },
    ];

    function errorOf(fn) {
        try {
            fn();
            return 'no-throw';
        } catch (error) {
            return error && error.name ? error.name + ':' + error.code + ':' + error.msg : String(error);
        }
    }

    root.xqsqlCases = [
        {
            title: 'add 生成多行 INSERT',
            run: function (api) {
                return api.add('goods', GOODS, FIELDS);
            },
            expected: "INSERT INTO `goods` (`name`, `number`, `price`) VALUES ('苹果', 10, 8.8), ('蓝莓', 20, 9.9)",
        },
        {
            title: 'add 单引号按 MySQL 规则转义',
            run: function (api) {
                return api.add('t', [{ s: "o'brien" }], [{ value: 's' }]);
            },
            expected: "INSERT INTO `t` (`s`) VALUES ('o\\'brien')",
        },
        {
            title: 'get default 单条',
            run: function (api) {
                return api.get('goods', { type: 'one', key: 'id', ids: [1] }, 'default', 'id,name');
            },
            expected: 'SELECT `id`, `name` FROM `goods` WHERE `id` = 1',
        },
        {
            title: 'get more 条件拼接与 LIKE 白名单',
            run: function (api) {
                return api.get('goods', { id: 1, name: '香蕉' }, 'more');
            },
            expected: "SELECT * FROM `goods` WHERE `id` = 1 AND `name` LIKE '%香蕉%'",
        },
        {
            title: 'get page 返回 sql 与 count',
            run: function (api) {
                return api.get('goods', {
                    list: { name: '香蕉' },
                    sorts: { name: 'create_time', val: 'desc' },
                    limits: { offset: 0, size: 10 },
                }, 'page');
            },
            expected: {
                sql: "SELECT * FROM `goods` WHERE `name` LIKE '%香蕉%' ORDER BY `create_time` DESC LIMIT 0, 10",
                count: "SELECT COUNT(*) FROM `goods` WHERE `name` LIKE '%香蕉%'",
            },
        },
        {
            title: 'up 单条更新保留小数',
            run: function (api) {
                return api.up('goods', { key: 'id', ids: [1], list: { price: 9.9 } }, [{ value: 'price' }]);
            },
            expected: 'UPDATE `goods` SET `price` = 9.9 WHERE `id` = 1',
        },
        {
            title: 'del 多条删除',
            run: function (api) {
                return api.del('goods', { key: 'id', ids: [1, 2, 3] }, 'more');
            },
            expected: 'DELETE FROM `goods` WHERE `id` IN (1, 2, 3)',
        },
        {
            title: '必填为空抛 101（不再引用 res）',
            run: function (api) {
                return errorOf(function () {
                    api.add('goods', [{ name: '' }], FIELDS);
                });
            },
            expected: 'XqSqlError:101:save_fail',
            panel: false,
        },
        {
            title: '排序方向注入被拒绝',
            run: function (api) {
                return errorOf(function () {
                    api.get('goods', {
                        sorts: { name: 'id', val: 'DESC; DROP TABLE t' },
                        limits: { size: 1 },
                    }, 'page');
                });
            },
            expected: 'XqSqlError:104:invalid_order',
            panel: false,
        },
        {
            title: 'likeFields 实例隔离',
            run: function (api) {
                return api.create({ likeFields: ['title'] }).get('t', { title: 'x', name: 'y' }, 'more');
            },
            expected: "SELECT * FROM `t` WHERE `title` LIKE '%x%' AND `name` = 'y'",
        },
        {
            title: '未知 type 抛 107（不返回 undefined）',
            run: function (api) {
                return errorOf(function () {
                    api.get('goods', { type: 'xx' });
                });
            },
            expected: 'XqSqlError:107:invalid_mode',
            panel: false,
        },
        {
            title: 'all 模式忽略 params',
            run: function (api) {
                return api.del('goods', '', 'all');
            },
            expected: 'DELETE FROM `goods`',
        },
    ];
})(typeof self !== 'undefined' ? self : this);
