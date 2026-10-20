/* AMD 分支：由 requirejs 注入模块，验证 define(factory) 分支。 */
define(['xqsql'], function (api) {
    'use strict';

    var checks = window.XqChecks;

    checks.check('requirejs 返回 xqsql 对象', function () {
        return api && typeof api.add === 'function' && typeof api.del === 'function';
    });

    checks.check('AMD 模块导出与 UMD 全局同构', function () {
        return typeof api.create === 'function' && typeof api.XqSqlError === 'function';
    });

    checks.check('AMD 分支可生成语句', function () {
        return api.get('goods', { type: 'all' }) === 'SELECT * FROM `goods`';
    });

    checks.runCases(api, { label: 'AMD' });
    checks.finish(api, 'AMD');
});
