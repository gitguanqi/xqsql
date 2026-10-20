import { CODES, fail } from './error.js';
import { assertIds, assertPlainObject, quoteIdentifier, quoteTable } from './identifier.js';
import { assertRequired, normalizeFields } from './fields.js';
import { encodeList, encodeValue } from './value.js';

const SUPPORTED_MODES = ['one', 'more', 'all'];

/**
 * 生成 UPDATE 语句。
 * `list` 中值为 undefined 表示「不更新」，null 会写入 NULL；没有任何可更新字段时抛 105。
 * @param {{likeFields: Set<string>}} state
 * @param {string} table
 * @param {{key?: string, ids?: Array<unknown>, list: Record<string, unknown>}} params
 * @param {Array<{name?: string, value: string, isMust?: boolean}>} fields
 * @param {'one'|'more'|'all'} [mode]
 * @returns {string}
 */
export function up(state, table, params, fields, mode = 'one') {
    if (!SUPPORTED_MODES.includes(mode)) {
        fail(CODES.INVALID_MODE, `不支持的更新模式: ${String(mode)}`, { mode });
    }

    const tableSql = quoteTable(table);
    const columns = normalizeFields(fields, 'up');
    const query = assertPlainObject(params, 'params');
    const list = assertPlainObject(query.list, 'params.list');

    const assignments = [];
    for (const field of columns) {
        if (!Object.prototype.hasOwnProperty.call(list, field.value)) {
            continue;
        }
        const value = list[field.value];
        if (value === undefined) {
            continue;
        }
        assertRequired(field, value, table);
        assignments.push(`${quoteIdentifier(field.value, '字段名')} = ${encodeValue(value)}`);
    }

    if (assignments.length === 0) {
        fail(CODES.EMPTY_INPUT, '没有可更新的字段', { table });
    }

    const updateSql = `UPDATE ${tableSql} SET ${assignments.join(', ')}`;
    if (mode === 'all') {
        return updateSql;
    }

    const key = quoteIdentifier(query.key, '条件字段');
    const ids = assertIds(query.ids, mode === 'one' ? 1 : -1, mode);

    if (mode === 'one') {
        return `${updateSql} WHERE ${key} = ${encodeValue(ids[0])}`;
    }
    return `${updateSql} WHERE ${key} IN (${encodeList(ids)})`;
}
