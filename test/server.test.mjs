import assert from 'node:assert/strict';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestServer, resolveRequestFile } from '../scripts/serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function withServer(run) {
    const server = createTestServer({ root });
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    const { port } = server.address();
    try {
        await run(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolveClose) => server.close(resolveClose));
    }
}

test('静态服务返回页面、正确的 MIME 与 no-store', async () => {
    await withServer(async (base) => {
        const redirect = await fetch(`${base}/`, { redirect: 'manual' });
        assert.equal(redirect.status, 302);
        assert.equal(redirect.headers.get('location'), '/test/');

        const index = await fetch(`${base}/test/`);
        assert.equal(index.status, 200);
        assert.match(index.headers.get('content-type'), /^text\/html/);
        assert.equal(index.headers.get('cache-control'), 'no-store');
        assert.match(await index.text(), /xqsql/);

        const module = await fetch(`${base}/lib/xqsql-esm.mjs`);
        assert.equal(module.status, 200);
        assert.match(module.headers.get('content-type'), /^text\/javascript/);

        const head = await fetch(`${base}/test/index.html`, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal((await head.arrayBuffer()).byteLength, 0);

        const rejected = await fetch(`${base}/test/index.html`, { method: 'POST' });
        assert.equal(rejected.status, 405);
    });
});

test('拒绝路径穿越、node_modules、缺失文件与坏编码', async () => {
    assert.equal(await resolveRequestFile(root, '/node_modules/typescript/package.json'), null);
    assert.equal(await resolveRequestFile(root, '/../../Windows/win.ini'), null);
    assert.equal(await resolveRequestFile(root, '/%E0%A4%A'), null);
    assert.equal(await resolveRequestFile(root, '/missing-page.html'), null);
    assert.equal(await resolveRequestFile(root, '/src'), null);

    const page = await resolveRequestFile(root, '/test/');
    assert.match(page ?? '', /test[\\/]index\.html$/);

    const script = await resolveRequestFile(root, '/lib/xqsql.js');
    assert.match(script ?? '', /lib[\\/]xqsql\.js$/);
});
