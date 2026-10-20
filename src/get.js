import { CODES, fail } from './error.js';
import {
    assertIds,
    assertPlainObject,
    normalizeOrder,
    quoteFieldList,
    quoteIdentifier,
    quoteTable,
    toInteger,
} from './identifier.js';
import { encodeList, encodeValue } from './value.js';

const DEFAULT_MODE = 'default';
const SUPPORTED_MODES = ['default', 'more', 'page'];

/**
 * 把条件对象编译成 `a = 1 AND b LIKE '%x%'`。
 * 跳过 null/undefined/''，保留 0 与 false；无有效条件时返回空串（调用方据此省略 WHERE）。
 * @param {{likeFields: Set<string>}} state
 * @param {Record<string, unknown>} conditions
 * @param {string} role
 * @returns {string}
 */
function buildConditions(state, conditions, role) {
    const record = assertPlainObject(conditions, role);
    const clauses = [];

    for (const key of Object.keys(record)) {
        const raw = record[key];
        if (raw === undefined || raw === null || raw === '') {
            continue;
        }
        const column = quoteIdentifier(key, '条件字段');
        if (state.likeFields.has(key)) {
            clauses.push(`${column} LIKE ${encodeValue(`%${String(raw)}%`)}`);
        } else {
            clauses.push(`${column} = ${encodeValue(raw)}`);
        }
    }

    return clauses.join(' AND ');
}

/**
 * 生成查询语句。`page` 模式返回 `{ sql, count }`，其余模式返回字符串。
 * @param {{likeFields: Set<string>}} state
 * @param {string} table
 * @param {Record<string, unknown>} params
 * @param {'default'|'more'|'page'} [mode]
 * @param {string|string[]} [field]
 * @returns {string|{sql: string, count: string}}
 */
export function get(state, table, params, mode = DEFAULT_MODE, field = '*') {
    if (!SUPPORTED_MODES.includes(mode)) {
        fail(CODES.INVALID_MODE, `不支持的查询模式: ${String(mode)}`, { mode });
    }

    const tableSql = quoteTable(table);
    const selectSql = `SELECT ${quoteFieldList(field)} FROM ${tableSql}`;
    const query = assertPlainObject(params, 'params');

    if (mode === 'default') {
        return buildDefaultQuery(query, selectSql);
    }

    if (mode === 'more') {
        const where = buildConditions(state, query, 'params');
        return where ? `${selectSql} WHERE ${where}` : selectSql;
    }

    return buildPageQuery(state, query, tableSql, selectSql);
}

/**
 * @param {Record<string, unknown>} params
 * @param {string} selectSql
 * @returns {string}
 */
function buildDefaultQuery(params, selectSql) {
    const type = params.type;

    if (type === 'all') {
        return selectSql;
    }

    if (type !== 'one' && type !== 'more') {
        fail(CODES.INVALID_MODE, `不支持的查询类型: ${String(type)}`, { type });
    }

    const key = quoteIdentifier(params.key, '条件字段');
    const ids = assertIds(params.ids, type === 'one' ? 1 : -1, type);

    if (type === 'one') {
        return `${selectSql} WHERE ${key} = ${encodeValue(ids[0])}`;
    }
    return `${selectSql} WHERE ${key} IN (${encodeList(ids)})`;
}

/**
 * @param {{likeFields: Set<string>}} state
 * @param {Record<string, unknown>} params
 * @param {string} tableSql
 * @param {string} selectSql
 * @returns {{sql: string, count: string}}
 */
function buildPageQuery(state, params, tableSql, selectSql) {
    const limits = assertPlainObject(params.limits, 'limits');
    const size = toInteger(limits.size, 'limits.size');
    // offset 为首选名，page 保留为等价别名（旧版语义本就是 offset，不是页码）。
    const offset = toInteger(limits.offset ?? limits.page, 'limits.offset', 0);

    const where = params.list === undefined || params.list === null
        ? ''
        : buildConditions(state, params.list, 'params.list');

    const whereSql = where ? ` WHERE ${where}` : '';
    const orderSql = params.sorts ? buildOrder(params.sorts) : '';

    return {
        sql: `${selectSql}${whereSql}${orderSql} LIMIT ${offset}, ${size}`,
        count: `SELECT COUNT(*) FROM ${tableSql}${whereSql}`,
    };
}

/**
 * @param {unknown} sorts
 * @returns {string}
 */
function buildOrder(sorts) {
    const record = assertPlainObject(sorts, 'sorts');
    if (record.name === undefined || record.name === null || record.name === '') {
        fail(CODES.INVALID_IDENTIFIER, 'sorts.name 必填');
    }
    const column = quoteIdentifier(record.name, '排序字段');
    return ` ORDER BY ${column} ${normalizeOrder(record.val)}`;
}
