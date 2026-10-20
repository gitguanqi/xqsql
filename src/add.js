import { CODES, fail } from './error.js';
import { assertPlainObject, quoteIdentifier, quoteTable } from './identifier.js';
import { assertRequired, normalizeFields } from './fields.js';
import { encodeValue } from './value.js';

/**
 * 生成 INSERT 语句。
 * 不再注入 `id` 列与 `(0, …)`：需要显式主键时把 `{ value: 'id' }` 放进 fields 并在行数据里给值。
 * @param {{likeFields: Set<string>}} state
 * @param {string} table 表名
 * @param {Array<Record<string, unknown>>} rows 行数据数组
 * @param {Array<{name?: string, value: string, isMust?: boolean}>} fields 字段描述数组
 * @returns {string}
 */
export function add(state, table, rows, fields) {
    const tableSql = quoteTable(table);
    const columns = normalizeFields(fields, 'add');

    if (!Array.isArray(rows) || rows.length === 0) {
        fail(CODES.EMPTY_INPUT, 'add 需要非空的行数组', { table });
    }

    const columnSql = columns
        .map((field) => quoteIdentifier(field.value, '字段名'))
        .join(', ');

    const tuples = rows.map((row, index) => {
        const record = assertPlainObject(row, `add 的第 ${index + 1} 行`, '对象');
        const values = columns.map((field) => {
            const value = record[field.value];
            assertRequired(field, value, table);
            return encodeValue(value);
        });
        return `(${values.join(', ')})`;
    });

    return `INSERT INTO ${tableSql} (${columnSql}) VALUES ${tuples.join(', ')}`;
}
