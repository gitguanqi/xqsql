import { CODES, fail } from './error.js';

/** 小写 `\x00` 等在正则里容易写错，集中在一处，转义顺序必须是反斜杠优先。 */
const ESCAPE_MAP = {
    '\\': '\\\\',
    "'": "\\'",
    '\x00': '\\0',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\b': '\\b',
    '\x1a': '\\Z',
};

const ESCAPE_PATTERN = /[\\'\x00\n\r\t\b\x1a]/g;

const pad2 = (value) => (value < 10 ? `0${value}` : String(value));

/**
 * 日期按本地时区格式化为 MySQL 的 DATETIME 字面量。
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    if (Number.isNaN(date.getTime())) {
        fail(CODES.INVALID_VALUE, '无效的日期值', { value: String(date) });
    }
    const ymd = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    const hms = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    return `${ymd} ${hms}`;
}

/**
 * 统一使用单引号 + 反斜杠转义，兼容 MySQL 默认 sql_mode。
 * @param {string} value
 * @returns {string} 带引号的 SQL 字面量
 */
export function quoteString(value) {
    return `'${value.replace(ESCAPE_PATTERN, (char) => ESCAPE_MAP[char])}'`;
}

/**
 * 把任意 JS 值编码为 SQL 字面量。
 * number 保留小数（旧版 parseInt 会把 8.8 截成 8），boolean 转 1/0，null/undefined 转 NULL。
 * @param {unknown} value
 * @returns {string}
 */
export function encodeValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }

    switch (typeof value) {
        case 'number':
            if (!Number.isFinite(value)) {
                fail(CODES.INVALID_VALUE, `不支持的数值: ${String(value)}`, { value });
            }
            return String(value);
        case 'bigint':
            return value.toString();
        case 'boolean':
            return value ? '1' : '0';
        case 'string':
            return quoteString(value);
        case 'object':
            if (value instanceof Date) {
                return quoteString(formatDate(value));
            }
            fail(CODES.INVALID_VALUE, '不支持的值类型: object', { value: String(value) });
            break;
        default:
            fail(CODES.INVALID_VALUE, `不支持的值类型: ${typeof value}`);
    }

    return 'NULL';
}

/**
 * 把一组 id 编码为 `IN (…)` 的列表内容。
 * @param {Array<number|string|bigint|boolean>} ids
 * @returns {string}
 */
export function encodeList(ids) {
    return ids.map((item) => encodeValue(item)).join(', ');
}
