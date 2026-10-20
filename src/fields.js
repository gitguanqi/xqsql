import { CODES, fail } from './error.js';
import { quoteIdentifier } from './identifier.js';

/**
 * 规范化字段描述数组：`{ name?, value, isMust? }`。
 * value 会立刻做标识符校验，避免非法列名进入 SQL。
 * @param {unknown} fields
 * @param {string} caller 调用方名称，用于错误文案
 * @returns {Array<{name: string, value: string, isMust: boolean}>}
 */
export function normalizeFields(fields, caller) {
    if (!Array.isArray(fields) || fields.length === 0) {
        fail(CODES.EMPTY_INPUT, `${caller} 需要非空的字段数组`);
    }

    return fields.map((item, index) => {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
            fail(CODES.INVALID_ARGUMENT, `${caller} 的 fields[${index}] 必须是对象`);
        }
        if (typeof item.value !== 'string' || item.value === '') {
            fail(CODES.INVALID_IDENTIFIER, `${caller} 的 fields[${index}].value 必填`);
        }
        quoteIdentifier(item.value, '字段名');
        return {
            name: typeof item.name === 'string' && item.name !== '' ? item.name : item.value,
            value: item.value,
            isMust: item.isMust === true,
        };
    });
}

/**
 * isMust 字段不允许为空串 / null / undefined。
 * @param {{name: string, value: string}} field
 * @param {unknown} value
 * @param {string} table
 */
export function assertRequired(field, value, table) {
    if (field.isMust && (value === '' || value === null || value === undefined)) {
        fail(CODES.SAVE_FAIL, `请填写${field.name}!`, { table, field: field.value });
    }
}
