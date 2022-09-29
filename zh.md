# xqsql

这是一个自动生成各种sql语句的方法仓库。

[查看英文文档](./README.md)

## 安装

**游览器端**:

引入cdn

```html
<!-- Browser -->
<script src="https://unpkg.com/xqsql/lib/xqsql.min.js"></script>
<!-- es module -->
<script type="module">
    import xqsql from '../lib/xqsql-esm.min.js';
</script>
```

**Node**:

```sh
npm install xqsql
```

```js
const xqsql = require('xqsql');
```

## 使用

### CURD操作

+ 创建记录

本方法适用于创建单条或者多条记录

req.body的参数

```js
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
```

字段数组

```js
const addFields = [
    {
        name: '商品名称',
        value:'name',
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
```

查看结果

```js
const addSql = xqsql.add('goods', addParams, addFields);
console.log('添加后的语句是：', addSql); 
// 添加后的语句是： INSERT INTO `goods` (id, name,number,price) VALUES (0,"苹果",10,8),(0,"蓝莓",20,9)
```

+ 获取信息

1.默认查询

req.query的参数

```js
let getDefaultOneParams = [1];
let getDefaultMoreParams = [1,2,3];
```

查看结果（默认模式单个）

```js
const getDefaultOneSql = xqsql.get('goods', {
    type: 'one',
    key: 'id',
    ids: getDefaultOneParams,
}, 'default', 'id,name,number,price');
console.log('查询默认模式(单个)：', getDefaultOneSql);
// 查询默认模式(单个)： SELECT id,name,number,price FROM `goods` WHERE id = '1'
```

查看结果（默认模式单个）

```js
const getDefaultMoreSql = xqsql.get('goods', {
    type: 'more',
    key: 'id',
    ids: getDefaultMoreParams,
}, 'default', 'id,name,number,price');
console.log('查询默认模式(多个)：', getDefaultMoreSql);
// 查询默认模式(多个)： SELECT id,name,number,price FROM `goods` WHERE id in (1,2,3)
```

查看结果（默认模式所有）

```js
const getDefaultSql = xqsql.get('goods', {
    type: 'all',
}, 'default', 'id,name,number,price');
console.log('查询默认模式(所有)：', getDefaultSql);
// 查询默认模式(所有)： SELECT id,name,number,price FROM `goods`
```

2.更多条件模式

```js
const getMoretSql = xqsql.get('goods', {
    id: 1,
    name: "香蕉",
}, 'more', 'id,name,number,price');
console.log('更多条件模式：', getMoretSql);
// 更多条件模式： SELECT id,name,number,price FROM `goods` WHERE  id = '1' AND name LIKE '%香蕉%'
```

3.分页查询

```js
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
/* 
分页列表查询后的语句是： {
  sql: "SELECT * FROM `goods` WHERE  name LIKE '%香蕉%' ORDER by create_time DESC LIMIT 0,10",
  count: "SELECT COUNT(id) FROM `goods` WHERE  name LIKE '%香蕉%'"
```

+ 更新

公共部分

```js
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
```

1.单条更新

```js
upParams.ids = [1];
let upOneSql = xqsql.up('goods', upParams, upFields);
console.log('更新（单条）语句：', upOneSql);
// 更新（单条）语句： UPDATE `goods` SET number = 10,price = 9 WHERE id = '1'
```

2.多条更新

```js
upParams.ids = [1,2,3];
let upMoreSql = xqsql.up('goods', upParams, upFields, 'more');
console.log('更新（多条）语句：', upMoreSql);
// 更新（多条）语句： UPDATE `goods` SET number = 10,price = 9 WHERE id in (1,2,3)
```

3.全部更新

```js
let upSql = xqsql.up('goods', upParams, upFields, 'all');
console.log('更新（全部）语句：', upSql);
// 更新（全部）语句： UPDATE `goods` SET number = 10,price = 9
```

+ 删除

参数 req.query

1.删除单个

```js
let delOneParams = {
    key: 'id',
    ids: [1]
};
let delOneSql = xqsql.del('goods', delOneParams);
console.log('删除（单条）语句：', delOneSql);
// 删除（单条）语句： DELETE FROM `goods` WHERE id = '1'
```

2.删除多个

```js
let delMoreParams = {
    key: 'id',
    ids: [1,2,3]
};
let delMoreSql = xqsql.del('goods', delMoreParams, 'more');
console.log('删除（多条）语句：', delMoreSql);
// 删除（多条）语句： DELETE FROM `goods` WHERE id in (1,2,3)
```

3.删除所有

```js
let delSql = xqsql.del('goods', '', 'all');
console.log('删除（所有）语句：', delSql);
// 删除（所有）语句： DELETE FROM `goods`
```

## 查看示例

运行这个脚本查看展示案例：`npm run test:node`, `npm run test:browser`。

## 提问题

[这里提问](https://github.com/gitguanqi/xqsql/issues/new)

## 作者

[@gitguanqi](https://github.com/gitguanqi)
