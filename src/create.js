import { CODES, fail } from './error.js';
import { add } from './add.js';
import { get } from './get.js';
import { up } from './up.js';
import { del } from './del.js';

/** 旧版硬编码在函数体里的 LIKE 字段白名单，保留为默认值。 */
export const DEFAULT_LIKE_FIELDS = ['name', 'user', 'origin_name', 'url'];

/**
 * 创建相互隔离的实例：`likeFields` 存在闭包里，不污染全局。
 * @param {{likeFields?: string[]}} [options]
 * @returns {{add: Function, get: Function, up: Function, del: Function}}
 */
export function create(options) {
    if (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options))) {
        fail(CODES.INVALID_ARGUMENT, 'options 必须是对象');
    }

    const likeFields = options && options.likeFields !== undefined
        ? options.likeFields
        : DEFAULT_LIKE_FIELDS;

    if (!Array.isArray(likeFields) || likeFields.some((item) => typeof item !== 'string')) {
        fail(CODES.INVALID_ARGUMENT, 'options.likeFields 必须是字符串数组');
    }

    const state = { likeFields: new Set(likeFields) };

    return {
        add: (table, rows, fields) => add(state, table, rows, fields),
        get: (table, params, mode, field) => get(state, table, params, mode, field),
        up: (table, params, fields, mode) => up(state, table, params, fields, mode),
        del: (table, params, mode) => del(state, table, params, mode),
    };
}
