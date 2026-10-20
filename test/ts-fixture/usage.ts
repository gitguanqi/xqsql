// 类型契约夹具：由 `npm run typecheck` 编译，确保声明文件与 API 用法同步。
import xqsql, { add, del, get, up } from 'xqsql';
import type { Field, PageResult, XqSqlError } from 'xqsql';

const fields: Field[] = [
    { name: '商品名称', value: 'name', isMust: true },
    { name: '商品价格', value: 'price' },
];

const insert: string = add('goods', [{ name: '苹果', price: 8.8 }], fields);

const page: PageResult = get('goods', {
    list: { name: '香蕉' },
    sorts: { name: 'create_time', val: 'DESC' },
    limits: { offset: 0, size: 10 },
}, 'page');

const one: string = get('goods', { type: 'one', key: 'id', ids: [1] }, 'default', ['id', 'name']);
const many: string = get('goods', { type: 'more', key: 'id', ids: [1, 2] });
const all: string = get('goods', { type: 'all' });
const conditions: string = get('goods', { name: '香蕉', price: 9.9 }, 'more');

const updated: string = up('goods', { key: 'id', ids: [1], list: { price: 9.9 } }, fields, 'one');
const removed: string = del('goods', { key: 'id', ids: [1, 2, 3] }, 'more');
const removedAll: string = del('goods', '', 'all');

const custom = xqsql.create({ likeFields: ['title'] });
const customOne: string = custom.get('goods', { title: 'x' }, 'more');
const named: string = xqsql.add('goods', [{ name: 'x' }], fields);

try {
    get('goods', { type: 'all' });
} catch (error) {
    const failure = error as XqSqlError;
    const code: number = failure.code;
    const body: { code: number; msg: string; data: { info: string } } = failure.toJSON();
    void code;
    void body;
}

export { all, conditions, customOne, insert, many, named, one, page, removed, removedAll, updated };
