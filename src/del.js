import { CODES, fail } from './error.js';
import { assertIds, assertPlainObject, quoteIdentifier, quoteTable } from './identifier.js';
import { encodeList, encodeValue } from './value.js';

const SUPPORTED_MODES = ['one', 'more', 'all'];

/**
 * 生成 DELETE 语句。`all` 模式完全忽略 params，便于沿用旧写法 `del('goods', '', 'all')`。
 * @param {{likeFields: Set<string>}} state
 * @param {string} table
 * @param {{key?: string, ids?: Array<unknown>}} [params]
 * @param {'one'|'more'|'all'} [mode]
 * @returns {string}
 */
export function del(state, table, params, mode = 'one') {
    if (!SUPPORTED_MODES.includes(mode)) {
        fail(CODES.INVALID_MODE, `不支持的删除模式: ${String(mode)}`, { mode });
    }

    const deleteSql = `DELETE FROM ${quoteTable(table)}`;
    if (mode === 'all') {
        return deleteSql;
    }

    const query = assertPlainObject(params, 'params');
    const key = quoteIdentifier(query.key, '条件字段');
    const ids = assertIds(query.ids, mode === 'one' ? 1 : -1, mode);

    if (mode === 'one') {
        return `${deleteSql} WHERE ${key} = ${encodeValue(ids[0])}`;
    }
    return `${deleteSql} WHERE ${key} IN (${encodeList(ids)})`;
}
