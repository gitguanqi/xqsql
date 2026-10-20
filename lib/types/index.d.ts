/**
 * xqsql 2.0.0 类型声明（手写，构建不会覆盖）。
 * 与 src/ 的实现一一对应；修改 API 时请同步此文件与 test/ts-fixture/usage.ts。
 */

/** 允许写入 SQL 的值。array / 普通对象会被运行时拒绝（错误码 108）。 */
export type SqlValue = string | number | bigint | boolean | Date | null | undefined;

/** 字段描述：`value` 是列名，`name` 只用于错误文案。 */
export interface Field {
    readonly name?: string;
    readonly value: string;
    readonly isMust?: boolean;
}

export interface Options {
    /** 走 LIKE 的列名白名单，默认 ['name', 'user', 'origin_name', 'url']。 */
    readonly likeFields?: readonly string[];
}

export interface OneParams {
    readonly type: 'one';
    readonly key: string;
    readonly ids: readonly SqlValue[];
}

export interface ManyParams {
    readonly type: 'more';
    readonly key: string;
    readonly ids: readonly SqlValue[];
}

export interface AllParams {
    readonly type: 'all';
}

export type DefaultParams = OneParams | ManyParams | AllParams;

/** `more` 模式的条件对象：key 为列名，值会按类型编码。 */
export interface ConditionParams {
    readonly [column: string]: SqlValue;
}

export interface PageParams {
    readonly list?: ConditionParams;
    readonly sorts?: { readonly name: string; readonly val?: 'ASC' | 'DESC' | 'asc' | 'desc' };
    readonly limits: {
        readonly size: number | string;
        /** 首选名，等价于 SQL 的 OFFSET。 */
        readonly offset?: number | string;
        /** 旧名兼容，语义同样是 OFFSET，不是页码。 */
        readonly page?: number | string;
    };
}

export interface PageResult {
    readonly sql: string;
    readonly count: string;
}

export interface UpdateParams {
    readonly key?: string;
    readonly ids?: readonly SqlValue[];
    readonly list: Record<string, SqlValue>;
}

export interface DeleteParams {
    readonly key?: string;
    readonly ids?: readonly SqlValue[];
}

/** 错误码：101 save_fail · 102 invalid_identifier · 103 invalid_number · 104 invalid_order
 *  105 empty_input · 106 invalid_ids · 107 invalid_mode · 108 invalid_value · 109 invalid_argument
 *  运行时只能通过 `xqsql.XqSqlError` 访问，此处仅导出类型。 */
declare class XqSqlError extends Error {
    readonly code: number;
    readonly msg: string;
    readonly info: string;
    readonly details: Record<string, unknown>;
    constructor(code: number, info?: string, details?: Record<string, unknown>);
    toJSON(): { code: number; msg: string; data: { info: string } };
}

export type { XqSqlError };

export type AddFn = (
    table: string,
    rows: readonly Record<string, SqlValue>[],
    fields: readonly Field[],
) => string;

export type GetFn = {
    (table: string, params: PageParams, mode: 'page', field?: string | readonly string[]): PageResult;
    (table: string, params: ConditionParams, mode: 'more', field?: string | readonly string[]): string;
    (table: string, params: DefaultParams, mode?: 'default', field?: string | readonly string[]): string;
};

export type UpFn = (
    table: string,
    params: UpdateParams,
    fields: readonly Field[],
    mode?: 'one' | 'more' | 'all',
) => string;

export type DelFn = (
    table: string,
    params?: DeleteParams | null | '',
    mode?: 'one' | 'more' | 'all',
) => string;

export type CreateFn = (options?: Options) => Xqsql;

export interface Xqsql {
    add: AddFn;
    get: GetFn;
    up: UpFn;
    del: DelFn;
    create: CreateFn;
    XqSqlError: typeof XqSqlError;
}

export declare const add: AddFn;
export declare const get: GetFn;
export declare const up: UpFn;
export declare const del: DelFn;

declare const xqsql: Xqsql;

export default xqsql;
