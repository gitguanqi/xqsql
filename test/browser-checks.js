/* UMD 分支：只依赖 script 标签加载出来的全局 xqsql。 */
(function (root) {
    'use strict';

    var checks = root.XqChecks;
    var api = root.xqsql;

    checks.check('全局 window.xqsql 可用', function () {
        return api && typeof api.add === 'function' && typeof api.get === 'function';
    });

    checks.check('UMD 产物暴露 create 与 XqSqlError', function () {
        return typeof api.create === 'function' && typeof api.XqSqlError === 'function';
    });

    checks.check('生成的语句里不再出现双引号字符串', function () {
        return api.add('t', [{ s: 'x' }], [{ value: 's' }]).indexOf('"') === -1;
    });

    checks.check('小数不再被截断', function () {
        return api.add('t', [{ p: 8.8 }], [{ value: 'p' }]).indexOf('8.8') !== -1;
    });

    checks.runCases(api, { label: 'UMD' });
    checks.finish(api, 'UMD');
})(window);
