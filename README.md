# xqsql

This is a method warehouse for automatically generating various sql statements.

[View Chinese documents](./zh.md)

## Install

**Browser**:

import cdn

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

## Usage

### CURD operation

+ Create record

This method is suitable for creating single or multiple records

Parameters of req.body

```js
const addParams = [
    {
        name:'Apple',
        number: 10,
        price: 8.8
    },
    {
        name:'Blueberry',
        number: 20,
        price: 9.9
    }
]
```

Field array

```js
const addFields = [
    {
        name:'Product name',
        value:'name',
        isMust: true
    },
    {
        name:'Product quantity',
        value:'number',
        isMust: true
    },
    {
        name:'Commodity price',
        value:'price',
        isMust: true
    }
]
```

View Results

```js
const addSql = xqsql.add('goods', addParams, addFields);
console.log('The added statement is:', addSql);

// The added statement is: INSERT INTO `goods` (id, name,number,price) VALUES (0,"apple",10,8),(0,"blueberry",20,9)
```

+ Get information

1. Default query

Parameters of req.query

```js
let getDefaultOneParams = [1];
let getDefaultMoreParams = [1,2,3];
```

View results (single in default mode)

```js
const getDefaultOneSql = xqsql.get('goods', {
    type:'one',
    key:'id',
    ids: getDefaultOneParams,
},'default','id,name,number,price');

console.log('Query default mode (single):', getDefaultOneSql);

// Query the default mode (single): SELECT id,name,number,price FROM `goods` WHERE id = '1'
```

View results (single in default mode)

```js
const getDefaultMoreSql = xqsql.get('goods', {
    type:'more',
    key:'id',
    ids: getDefaultMoreParams,
},'default','id,name,number,price');

console.log('Query default mode (multiple):', getDefaultMoreSql);

// Query the default mode (multiple): SELECT id,name,number,price FROM `goods` WHERE id in (1,2,3)
```

View results (all in default mode)

```js
const getDefaultSql = xqsql.get('goods', {
    type:'all',
},'default','id,name,number,price');

console.log('Query default mode (all):', getDefaultSql);
// Query the default mode (all): SELECT id,name,number,price FROM `goods`
```

2.More conditional modes

```js
const getMoretSql = xqsql.get('goods', {
    id: 1,
    name: "Banana",
},'more','id,name,number,price');

console.log('More condition mode:', getMoretSql);
// More conditional patterns: SELECT id,name,number,price FROM `goods` WHERE id = '1' AND name LIKE'%banana%'
```

3.Paging query

```js
let getListParams = {
    name: "Banana",
    page: 1,
    size: 10,
};
let currentPageSize = (getListParams.page-1) * getListParams.size;
let getListFields = [
    {
        name:'Product name',
        value:'name'
    },
    {
        name:'Product quantity',
        value:'number'
    },
    {
        name:'Commodity price',
        value:'price'
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
        name: getListParams.sort ||'create_time',
        val: getListParams.sortRule ||'DESC'
    },
    limits: {
        page: currentPageSize,
        size: getListParams.size || 10
    }
},'page');

console.log('The sentence after the paging list query is:', getListSql);
/*
The sentence after the paging list query is: {
  sql: "SELECT * FROM `goods` WHERE name LIKE'%banana%' ORDER by create_time DESC LIMIT 0,10",
  count: "SELECT COUNT(id) FROM `goods` WHERE name LIKE'%banana%'"
}
*/
```

+ Update

Public section

```js
const upParams = {
    key:'id',
    ids: null,
    list: {
        number: 10,
        price: 9.9
    }
}

const upFields = [
    {
        name:'Product quantity',
        value:'number',
        isMust: true
    },
    {
        name:'Commodity price',
        value:'price',
        isMust: true
    }
]
```

1. Single update

```js
upParams.ids = [1];
let upOneSql = xqsql.up('goods', upParams, upFields);
console.log('Update (single) statement:', upOneSql);
// Update (single) statement: UPDATE `goods` SET number = 10,price = 9 WHERE id = '1'
```

2.Multiple updates

```js
upParams.ids = [1,2,3];
let upMoreSql = xqsql.up('goods', upParams, upFields,'more');
console.log('Update (multiple) statements:', upMoreSql);
// Update (multiple) statements: UPDATE `goods` SET number = 10,price = 9 WHERE id in (1,2,3)
```

3.Update all

```js
let upSql = xqsql.up('goods', upParams, upFields,'all');
console.log('Update (all) statement:', upSql);
// Update (all) statement: UPDATE `goods` SET number = 10, price = 9
```

+ Delete

Parameter req.query

1. Delete a single

```js
let delOneParams = {
    key:'id',
    ids: [1]
};
let delOneSql = xqsql.del('goods', delOneParams);
console.log('Delete (single) statement:', delOneSql);
// Delete (single) statement: DELETE FROM `goods` WHERE id = '1'
```

2.Delete multiple

```js
let delMoreParams = {
    key:'id',
    ids: [1,2,3]
};
let delMoreSql = xqsql.del('goods', delMoreParams,'more');
console.log('Delete (multiple) statements:', delMoreSql);
// Delete (multiple) statements: DELETE FROM `goods` WHERE id in (1,2,3)
```

3.Delete all

```js
let delSql = xqsql.del('goods','','all');
console.log('Delete (all) statements:', delSql);
// Delete (all) statements: DELETE FROM `goods`
```

## View xqsql

Run this script to view the demonstration case: `npm run test:node`, `npm run test:browser`.

## ask questions

[submit your question](https://github.com/gitguanqi/xqsql/issues/new)

## Author

[@gitguanqi](https://github.com/gitguanqi)
