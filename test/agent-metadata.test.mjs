import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Agent 元数据验收：`llms` / `agents` 指向真实文件、进入发布清单、
 * 且 llms.txt 记录的黄金 SQL 必须与运行时输出逐字相同。
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const read = (file) => readFile(at(file), 'utf8');
const require = createRequire(import.meta.url);

const pkg = JSON.parse(await read('package.json'));
const llms = await read(pkg.llms.replace(/^\.\//, ''));
const skillPath = pkg.agents.replace(/^\.\//, '');
const skill = await read(skillPath);
const skillDir = dirname(skillPath);

/** 解析 SKILL.md 的 YAML frontmatter，只取本包用到的两个标量字段。 */
function frontmatter(source) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
    assert.ok(match, 'SKILL.md 必须以 YAML frontmatter 开头');

    const fields = {};
    for (const line of match[1].split(/\r?\n/)) {
        const pair = /^([A-Za-z][\w-]*):\s*(.+)$/.exec(line.trim());
        if (pair) {
            fields[pair[1]] = pair[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
    return fields;
}

test('package.json 声明 llms 与 agents，且不改变任何运行时入口', () => {
    assert.equal(pkg.llms, './llms.txt');
    assert.equal(pkg.agents, './skills/xqsql-sql-builder/SKILL.md');

    // 元数据只新增字段，入口保持 2.0.0 的形态
    assert.equal(pkg.main, 'lib/xqsql.js');
    assert.equal(pkg.module, 'lib/xqsql-esm.mjs');
    assert.equal(pkg.browser, 'lib/xqsql.min.js');
    assert.equal(pkg.types, 'lib/types/index.d.ts');
    assert.deepEqual(Object.keys(pkg.exports), ['.', './lib/*', './package.json']);
    assert.equal(pkg.dependencies, undefined);
});

test('llms 与 agents 目标在磁盘上存在且被打进发布包', async () => {
    await access(at('llms.txt'));
    await access(at(skillPath));
    await access(at(skillDir, 'references', 'api.md'));

    assert.ok(pkg.files.includes('llms.txt'), 'files 缺少 llms.txt');
    assert.ok(pkg.files.includes('skills'), 'files 缺少 skills 目录');

    const entries = await readdir(at(skillDir));
    assert.ok(entries.includes('SKILL.md'));
    assert.ok(entries.includes('references'));
});

test('llms.txt 覆盖全部运行时导出与错误码', () => {
    for (const name of ['add', 'get', 'up', 'del', 'create', 'XqSqlError']) {
        assert.ok(llms.includes(`\`${name}`) || llms.includes(`${name}(`), `llms.txt 未记录 ${name}`);
    }

    for (const code of ['101', '102', '103', '104', '105', '106', '107', '108', '109']) {
        assert.ok(llms.includes(`| ${code} |`), `llms.txt 缺少错误码 ${code}`);
    }

    for (const keyword of ['require(', 'import xqsql', 'lib/xqsql.min.js', 'likeFields', 'offset']) {
        assert.ok(llms.includes(keyword), `llms.txt 缺少关键说明 ${keyword}`);
    }

    assert.match(llms, /never connects|no connection|does not connect/i);
});

test('llms.txt 里的黄金 SQL 与运行时输出逐字一致', () => {
    const xqsql = require('xqsql');
    const GOODS_FIELDS = [
        { name: 'name', value: 'name' },
        { name: 'qty', value: 'number' },
        { name: 'price', value: 'price' },
    ];

    const page = xqsql.get('goods', {
        list: { name: 'banana' },
        sorts: { name: 'create_time', val: 'DESC' },
        limits: { offset: 0, size: 10 },
    }, 'page');

    const samples = [
        xqsql.add('goods', [{ name: 'apple', number: 10, price: 8.8 }], GOODS_FIELDS),
        xqsql.get('goods', { name: 'apple', number: 10 }, 'more'),
        page.sql,
        page.count,
        xqsql.up('goods', { key: 'id', ids: [1], list: { price: 9.9 } }, GOODS_FIELDS),
    ];

    for (const sql of samples) {
        assert.ok(llms.includes(sql), `llms.txt 记录的 SQL 与运行时不一致: ${sql}`);
    }

    // 文档里额外声明的两条旧行为必须仍成立
    assert.ok(llms.includes("del('goods', '', 'all')"));
    assert.equal(xqsql.del('goods', '', 'all'), 'DELETE FROM `goods`');
});

test('SKILL.md frontmatter 合法，名称与目录一致', () => {
    const meta = frontmatter(skill);

    assert.equal(meta.name, 'xqsql-sql-builder');
    assert.match(meta.name, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    assert.equal(meta.name, skillDir.replace(/\\/g, '/').split('/').pop());
    assert.ok(meta.description.length > 40, 'description 需要说明能力与加载时机');
    assert.match(meta.description, /load when|integrat/i);
});

test('SKILL.md 引用的相对路径都在 skill 目录内', async () => {
    const links = [...skill.matchAll(/\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !/^(https?:|#|mailto:)/.test(target));

    assert.ok(links.length > 0, 'SKILL.md 至少要链接 references/api.md');
    for (const target of links) {
        const relative = target.split('#')[0];
        assert.ok(!isAbsolute(relative), `不允许绝对路径: ${relative}`);
        assert.ok(!relative.startsWith('..'), `不允许跳出 skill 目录: ${relative}`);
        await access(at(skillDir, relative));
    }
});

test('文档没有遗留占位符', () => {
    for (const [name, source] of [['llms.txt', llms], ['SKILL.md', skill]]) {
        assert.doesNotMatch(source, /\b(TODO|FIXME|TBD)\b/, `${name} 留有占位符`);
        assert.doesNotMatch(source, /<your[-_ ]/i, `${name} 留有占位符`);
    }
});
