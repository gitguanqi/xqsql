// 零依赖测试服务器：只服务仓库内的静态文件，供 test/*.html 自查页面使用。
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PAGES = ['/test/', '/test/browser.html', '/test/esm.html', '/test/amd.html'];

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
};

function isInside(root, target) {
    return target === root || target.startsWith(root + sep);
}

function hasBlockedSegment(root, target) {
    const relative = target.slice(root.length).split(sep).filter(Boolean);
    return relative.includes('node_modules');
}

export async function resolveRequestFile(root, pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return null;
    }

    const target = resolve(root, decoded.replace(/^[/\\]+/, ''));
    if (!isInside(root, target) || hasBlockedSegment(root, target)) {
        return null;
    }

    try {
        const info = await stat(target);
        if (!info.isDirectory()) {
            return info.isFile() ? target : null;
        }

        const index = join(target, 'index.html');
        const indexInfo = await stat(index);
        return indexInfo.isFile() ? index : null;
    } catch {
        return null;
    }
}

function sendText(response, status, text, headers = {}) {
    response.writeHead(status, {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
        ...headers,
    });
    response.end(text);
}

export function createTestServer({ root = DEFAULT_ROOT } = {}) {
    const resolvedRoot = resolve(root);

    return createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            sendText(response, 405, 'Method not allowed', { allow: 'GET, HEAD' });
            return;
        }

        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname === '/') {
            response.writeHead(302, { location: '/test/', 'cache-control': 'no-store' });
            response.end();
            return;
        }

        const file = await resolveRequestFile(resolvedRoot, url.pathname);
        if (!file) {
            sendText(response, 404, 'Not found');
            return;
        }

        response.writeHead(200, {
            'cache-control': 'no-store',
            'content-type': MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
            'x-content-type-options': 'nosniff',
        });

        if (request.method === 'HEAD') {
            response.end();
            return;
        }

        const stream = createReadStream(file);
        stream.on('error', () => {
            if (!response.headersSent) {
                sendText(response, 500, 'Unable to read file');
            } else {
                response.destroy();
            }
        });
        stream.pipe(response);
    });
}

const isEntryPoint =
    process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isEntryPoint) {
    const host = process.env.HOST ?? '127.0.0.1';
    const port = Number(process.env.PORT ?? 4001);
    const server = createTestServer();
    server.listen(port, host, () => {
        console.log(`xqsql: test pages running at http://${host}:${port}/test/`);
        for (const page of PAGES) {
            console.log(`  http://${host}:${port}${page}`);
        }
    });
}
