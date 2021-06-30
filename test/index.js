const xqsql = require('../index');

// 创建记录

// 本方法适用于创建单条或者多条记录
console.log('-------------------- 创建记录 开始 --------------------');

// req.body的参数
const addParams = [
    {
        name: '苹果',
        number: 10,
        price: 8.8
    },
    {
        name: '蓝莓',
        number: 20,
        price: 9.9
    }
]

// 字段数组
const addFields = [
    {
        name: '商品名称',
        value: 'name',
        isMust: true
    },
    {
        name: '商品数量',
        value: 'number',
        isMust: true
    },
    {
        name: '商品价格',
        value: 'price',
        isMust: true
    }
]

const addSql = xqsql.add('goods', addParams, addFields);

console.log('添加后的语句是：', addSql); // 添加后的语句是： INSERT INTO `goods` (id, name,number,price) VALUES (0,"苹果",10,8),(0,"蓝莓",20,9)

console.log('-------------------- 创建记录 结束 --------------------');

// 获取信息
console.log('-------------------- 查询记录 开始 --------------------');
// 1.默认查询
// req.query的参数
let getDefaultOneParams = [1];
let getDefaultMoreParams = [1,2,3];

const getDefaultOneSql = xqsql.get('goods', {
    type: 'one',
    key: 'id',
    ids: getDefaultOneParams,
}, 'default', 'id,name,number,price');

console.log('查询默认模式(单个)：', getDefaultOneSql);

const getDefaultMoreSql = xqsql.get('goods', {
    type: 'more',
    key: 'id',
    ids: getDefaultMoreParams,
}, 'default', 'id,name,number,price');

console.log('查询默认模式(多个)：', getDefaultMoreSql);

const getDefaultSql = xqsql.get('goods', {
    type: 'all',
}, 'default', 'id,name,number,price');

console.log('查询默认模式(所有)：', getDefaultSql);

// 2.更多条件模式
const getMoretSql = xqsql.get('goods', {
    id: 1,
    name: "香蕉",
}, 'more', 'id,name,number,price');

console.log('更多条件模式：', getMoretSql);

// 3. 分页查询
let getListParams = {
    name: "香蕉",
    page: 1,
    size: 10,
};
let currentPageSize = (getListParams.page - 1) * getListParams.size;
let getListFields = [
    {
        name: '商品名称',
        value: 'name'
    },
    {
        name: '商品数量',
        value: 'number'
    },
    {
        name: '商品价格',
        value: 'price'
    }
]

let getList = {};

for (const item of getListFields) {
    let k = item.value;
    if (getListParams[k]) {
        getList[k] = getListParams[k];
    }
    if (getListParams[k] === 0) {
        getList[k] = 0;
    }
}

let getListSql = xqsql.get('goods', {
    list: getList,
    sorts: {
        name: getListParams.sort || 'create_time',
        val: getListParams.sortRule || 'DESC'
    },
    limits: {
        page: currentPageSize,
        size: getListParams.size || 10
    }
}, 'page');

console.log('分页列表查询后的语句是：', getListSql);
console.log('-------------------- 查询记录 结束 --------------------');

// 更新
console.log('-------------------- 更新记录 开始 --------------------');
// 公共部分
const upParams = {
    key: 'id',
    ids: null,
    list: {
        number: 10,
        price: 9.9
    }
}

const upFields = [
    {
        name: '商品数量',
        value: 'number',
        isMust: true
    },
    {
        name: '商品价格',
        value: 'price',
        isMust: true
    }
]

// 1.单条更新
upParams.ids = [1];
let upOneSql = xqsql.up('goods', upParams, upFields);
console.log('更新（单条）语句：', upOneSql);

// 2.多条更新
upParams.ids = [1,2,3];
let upMoreSql = xqsql.up('goods', upParams, upFields, 'more');
console.log('更新（多条）语句：', upMoreSql);

// 3.全部更新
let upSql = xqsql.up('goods', upParams, upFields, 'all');
console.log('更新（全部）语句：', upSql);

console.log('-------------------- 更新记录 结束 --------------------');

// 删除

console.log('-------------------- 删除记录 结束 --------------------');

// 参数 req.query

// 1.删除单个
let delOneParams = {
    key: 'id',
    ids: [1]
};
let delOneSql = xqsql.del('goods', delOneParams);
console.log('删除（单条）语句：', delOneSql);

// 2.删除多个
let delMoreParams = {
    key: 'id',
    ids: [1,2,3]
};
let delMoreSql = xqsql.del('goods', delMoreParams, 'more');
console.log('删除（多条）语句：', delMoreSql);

// 3.删除所有
let delSql = xqsql.del('goods', '', 'all');
console.log('删除（所有）语句：', delSql);

console.log('-------------------- 删除记录 结束 --------------------');