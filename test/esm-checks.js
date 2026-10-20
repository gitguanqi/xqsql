/* ESM 分支：默认导出与命名导出必须指向同一批函数。 */
import xqsql, { add, del, get, up } from '../lib/xqsql-esm.min.js';

const checks = window.XqChecks;

checks.check('ESM 默认导出的四个方法与命名导出一致', () => (
    xqsql.add === add && xqsql.get === get && xqsql.up === up && xqsql.del === del
));

checks.check('命名导出可直接调用', () => add('t', [{ s: 'x' }], [{ value: 's' }]).indexOf('VALUES') !== -1);

checks.check('ESM 产物暴露 create 与 XqSqlError', () => (
    typeof xqsql.create === 'function' && typeof xqsql.XqSqlError === 'function'
));

checks.check('错误对象可 JSON 化', () => {
    try {
        get('goods', { type: 'xx' });
        return false;
    } catch (error) {
        const body = error.toJSON();
        return body.code === 107 && body.msg === 'invalid_mode' && typeof body.data.info === 'string';
    }
});

checks.runCases(xqsql, { label: 'ESM' });
checks.finish(xqsql, 'ESM');
