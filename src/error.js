/**
 * 统一错误：所有非法输入都以 XqSqlError 抛出，不再返回 undefined 或依赖宿主对象。
 * code 为数字，msg 为机器可读短串，info 为人类可读中文，details 为可选的定位信息。
 */
export const CODES = {
    SAVE_FAIL: 101,
    INVALID_IDENTIFIER: 102,
    INVALID_NUMBER: 103,
    INVALID_ORDER: 104,
    EMPTY_INPUT: 105,
    INVALID_IDS: 106,
    INVALID_MODE: 107,
    INVALID_VALUE: 108,
    INVALID_ARGUMENT: 109,
};

const MESSAGES = {
    101: 'save_fail',
    102: 'invalid_identifier',
    103: 'invalid_number',
    104: 'invalid_order',
    105: 'empty_input',
    106: 'invalid_ids',
    107: 'invalid_mode',
    108: 'invalid_value',
    109: 'invalid_argument',
};

export class XqSqlError extends Error {
    /**
     * @param {number} code 错误码，见 CODES
     * @param {string} [info] 面向用户的中文说明
     * @param {object} [details] 附加定位信息，不进入 toJSON 的 data
     */
    constructor(code, info, details) {
        const msg = MESSAGES[code] || MESSAGES[109];
        super(info ? `${msg}: ${info}` : msg);
        this.name = 'XqSqlError';
        this.code = code;
        this.msg = msg;
        this.info = info || '';
        this.details = details || {};
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, XqSqlError);
        }
    }

    /**
     * 与 1.x 里 res.json 的响应体结构保持一致，便于 Express 侧平滑迁移。
     * @returns {{code: number, msg: string, data: {info: string}}}
     */
    toJSON() {
        return {
            code: this.code,
            msg: this.msg,
            data: { info: this.info },
        };
    }
}

/**
 * @param {number} code
 * @param {string} info
 * @param {object} [details]
 * @returns {never}
 */
export function fail(code, info, details) {
    throw new XqSqlError(code, info, details);
}
