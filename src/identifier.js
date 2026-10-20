import { CODES, fail } from './error.js';

/** 字段名/条件键/排序字段：ASCII 标识符，最长 64 字符（MySQL 列名上限）。 */
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,63}$/;

/** 表名允许一段可选的 `schema.table`。 */
const TABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]{0,63}(\.[A-Za-z_][A-Za-z0-9_$]{0,63})?$/;

/**
 * @param {unknown} value
 * @param {string} role 用于错误文案，例如「表名」「字段名」
 * @param {string} [expected] 期望的类型描述
 * @returns {Record<string, unknown>}
 */
export function assertPlainObject(value, role, expected = '对象') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        fail(CODES.INVALID_ARGUMENT, `${role} 必须是${expected}`);
    }
    return value;
}

/**
 * 校验并包裹单个标识符。
 * @param {unknown} name
 * @param {string} role
 * @returns {string} `` `name` ``
 */
export function quoteIdentifier(name, role = '字段名') {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
        fail(CODES.INVALID_IDENTIFIER, `非法的${role}: ${String(name)}`, { name });
    }
    return `\`${name}\``;
}

/**
 * 校验并包裹表名，`schema.table` 会拆成两段分别加反引号。
 * @param {unknown} table
 * @returns {string}
 */
export function quoteTable(table) {
    if (typeof table !== 'string' || !TABLE_PATTERN.test(table)) {
        fail(CODES.INVALID_IDENTIFIER, `非法的表名: ${String(table)}`, { table });
    }
    return table
        .split('.')
        .map((part) => `\`${part}\``)
        .join('.');
}

/**
 * 解析 SELECT 的字段列表：支持 `'*'`、逗号分隔字符串、字符串数组。
 * @param {unknown} field
 * @returns {string}
 */
export function quoteFieldList(field) {
    if (field === undefined || field === null) {
        return '*';
    }

    const tokens = Array.isArray(field) ? field : String(field).split(',');
    const columns = tokens.map((token) => {
        const name = typeof token === 'string' ? token.trim() : token;
        if (name === '*') {
            return '*';
        }
        return quoteIdentifier(name, '字段名');
    });

    if (columns.length === 0 || (columns.length === 1 && columns[0] === '')) {
        fail(CODES.INVALID_IDENTIFIER, '字段列表不能为空');
    }
    return columns.join(', ');
}

/**
 * 排序方向只接受 ASC / DESC，输出统一大写。
 * @param {unknown} direction
 * @returns {'ASC'|'DESC'}
 */
export function normalizeOrder(direction) {
    if (direction === undefined || direction === null || direction === '') {
        return 'DESC';
    }
    const upper = String(direction).toUpperCase();
    if (upper !== 'ASC' && upper !== 'DESC') {
        fail(CODES.INVALID_ORDER, `排序方向只能是 ASC 或 DESC，收到 ${String(direction)}`, {
            direction,
        });
    }
    return upper;
}

/**
 * LIMIT / OFFSET / COUNT 一律非负安全整数，接受纯数字字符串。
 * @param {unknown} value
 * @param {string} label
 * @param {number} [fallback]
 * @returns {number}
 */
export function toInteger(value, label, fallback) {
    if (value === undefined || value === null || value === '') {
        if (fallback !== undefined) {
            return fallback;
        }
        fail(CODES.INVALID_NUMBER, `${label} 必填`);
    }

    const numeric = typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : value;

    if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric) || numeric < 0) {
        fail(CODES.INVALID_NUMBER, `${label} 必须是 0 ~ ${Number.MAX_SAFE_INTEGER} 之间的整数`, {
            value,
        });
    }
    return numeric;
}

/**
 * 校验 ids 列表：必须是数组，`one` 模式要求长度恰为 1，`more` 模式要求非空。
 * @param {unknown} ids
 * @param {number} expectedLength -1 表示「至少一个」
 * @param {string} mode
 * @returns {Array<unknown>}
 */
export function assertIds(ids, expectedLength, mode) {
    if (!Array.isArray(ids)) {
        fail(CODES.INVALID_IDS, `${mode} 模式要求 ids 是数组`, { ids });
    }
    if (expectedLength === 1) {
        if (ids.length !== 1) {
            fail(CODES.INVALID_IDS, `${mode} 模式要求 ids 长度为 1，收到 ${ids.length}`, { ids });
        }
        return ids;
    }
    if (ids.length === 0) {
        fail(CODES.INVALID_IDS, `${mode} 模式要求 ids 至少包含一个元素`, { ids });
    }
    return ids;
}
