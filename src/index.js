import { create } from './create.js';
import { XqSqlError } from './error.js';

const xqsql = create();

/**
 * 仅四个语句构造器作为命名导出；`create` 与 `XqSqlError` 挂在默认导出上，
 * 避免命名导出面随内部模块增加而膨胀。
 */
export const add = xqsql.add;
export const get = xqsql.get;
export const up = xqsql.up;
export const del = xqsql.del;

export default {
    add,
    get,
    up,
    del,
    create,
    XqSqlError,
};
