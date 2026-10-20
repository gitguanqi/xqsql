// 用本机 Chrome/Edge + CDP 打开三个自查页面，读取 window.__XQSQL_TEST__ 并核对可见结果面板。
// 不引入任何依赖：WebSocket 来自 Node 22 内置实现。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestServer } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['browser.html', 'esm.html', 'amd.html'];
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function findBrowser() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean);

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function connectCdp(url) {
    return new Promise((resolveConnection, reject) => {
        const socket = new WebSocket(url);
        const pending = new Map();
        const handlers = new Map();
        let nextId = 0;

        socket.addEventListener('open', () => {
            resolveConnection({
                send(method, params = {}, sessionId) {
                    const id = ++nextId;
                    return new Promise((resolveMessage, rejectMessage) => {
                        const timer = setTimeout(() => {
                            pending.delete(id);
                            rejectMessage(new Error(`CDP timeout: ${method}`));
                        }, 15000);
                        pending.set(id, { resolve: resolveMessage, reject: rejectMessage, timer });
                        socket.send(JSON.stringify({ id, method, params, sessionId }));
                    });
                },
                on(method, handler) {
                    const list = handlers.get(method) ?? [];
                    list.push(handler);
                    handlers.set(method, list);
                    return () => {
                        handlers.set(method, (handlers.get(method) ?? []).filter((item) => item !== handler));
                    };
                },
                close() {
                    socket.close();
                },
            });
        });

        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const request = pending.get(message.id);
                if (!request) return;
                clearTimeout(request.timer);
                pending.delete(message.id);
                if (message.error) {
                    request.reject(new Error(message.error.message));
                } else {
                    request.resolve(message.result);
                }
                return;
            }

            for (const handler of handlers.get(message.method) ?? []) {
                handler(message);
            }
        });

        socket.addEventListener('error', () => reject(new Error('Unable to connect to browser CDP')));
    });
}

function waitForDevtoolsUrl(child) {
    return new Promise((resolveUrl, reject) => {
        let output = '';
        const timer = setTimeout(() => {
            reject(new Error(`Timed out waiting for browser DevTools.\n${output}`));
        }, 15000);

        child.stderr.on('data', (chunk) => {
            output += chunk.toString();
            const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
            if (match) {
                clearTimeout(timer);
                resolveUrl(match[1]);
            }
        });
        child.once('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`Browser exited before DevTools was ready (code ${code}).\n${output}`));
        });
    });
}

async function evaluate(browser, sessionId, expression) {
    const result = await browser.send(
        'Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
    );
    return result.result.value;
}

async function verifyPage(browser, baseUrl, page) {
    const errors = [];
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const offs = [];

    try {
        await Promise.all([
            browser.send('Page.enable', {}, sessionId),
            browser.send('Runtime.enable', {}, sessionId),
            browser.send('Log.enable', {}, sessionId),
            browser.send(
                'Emulation.setDeviceMetricsOverride',
                { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
                sessionId,
            ),
        ]);

        offs.push(
            browser.on('Runtime.exceptionThrown', (event) => {
                const detail = event.params.exceptionDetails;
                errors.push(detail.exception?.description ?? detail.text ?? 'Uncaught exception');
            }),
            browser.on('Runtime.consoleAPICalled', (event) => {
                if (event.params.type === 'error' || event.params.type === 'assert') {
                    const text = event.params.args
                        .map((argument) => argument.value ?? argument.description ?? '')
                        .join(' ');
                    errors.push(text || `console.${event.params.type}`);
                }
            }),
            browser.on('Log.entryAdded', (event) => {
                if (event.params.entry.level === 'error') {
                    errors.push(event.params.entry.text);
                }
            }),
        );

        await browser.send('Page.navigate', { url: `${baseUrl}/test/${page}` }, sessionId);

        const deadline = Date.now() + 30000;
        let state = null;
        while (Date.now() < deadline) {
            try {
                state = await evaluate(browser, sessionId, 'window.__XQSQL_TEST__ ?? null');
                if (state && state.status !== 'running') break;
            } catch {
                // 导航期间执行上下文会被替换，重试即可。
            }
            await sleep(200);
        }

        if (!state || state.status === 'running') {
            throw new Error('test runner did not finish within 30 seconds');
        }

        // 页面结束后必须仍有可用实例与可读的结果面板。
        const panel = await evaluate(browser, sessionId, `(() => {
            const rows = [...document.querySelectorAll('#results li')].map((node) => node.textContent);
            const demo = window.__XQSQL_DEMO__;
            let probe = null;
            try {
                probe = demo && demo.api ? demo.api.get('goods', { type: 'all' }) : null;
            } catch (error) {
                probe = 'error:' + error.message;
            }
            return { count: rows.length, first: rows[0] || '', probe, summary: document.getElementById('summary').textContent };
        })()`);

        if (panel.count < 8) {
            throw new Error(`结果面板只有 ${panel.count} 条，期望至少 8 条`);
        }
        if (!panel.first.includes('INSERT INTO')) {
            throw new Error(`结果面板首条不是 INSERT：${panel.first}`);
        }
        if (panel.probe !== 'SELECT * FROM `goods`') {
            throw new Error(`页面结束后实例不可用：${panel.probe}`);
        }
        if (!/^PASS/.test(panel.summary)) {
            throw new Error(`#summary 未显示 PASS：${panel.summary}`);
        }

        await browser.send(
            'Emulation.setDeviceMetricsOverride',
            { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
            sessionId,
        );
        await sleep(150);
        const layout = await evaluate(
            browser,
            sessionId,
            '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
        );

        const combinedErrors = [...(state.errors ?? []), ...errors].filter(Boolean);
        if (state.status !== 'passed' || combinedErrors.length > 0) {
            throw new Error(combinedErrors.join(' | ') || 'the page reported a failure');
        }
        if (layout.scrollWidth > layout.innerWidth + 1) {
            throw new Error(`390px viewport overflows (${layout.scrollWidth}px > ${layout.innerWidth}px)`);
        }

        return { checks: (state.passed ?? 0) + (state.failed ?? 0), panel: panel.count, width: layout.innerWidth };
    } finally {
        offs.forEach((off) => off());
        await browser.send('Target.closeTarget', { targetId }).catch(() => undefined);
    }
}

const executable = findBrowser();
if (!executable) {
    console.error('xqsql: no Chrome or Edge executable found; set CHROME_PATH to run browser checks.');
    process.exitCode = 1;
} else {
    const server = createTestServer({ root });
    let browserProcess;
    let cdp;
    let profile;

    try {
        await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;
        profile = await mkdtemp(join(tmpdir(), 'xqsql-browser-'));
        browserProcess = spawn(
            executable,
            [
                '--headless=new',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-background-networking',
                '--disable-component-update',
                '--no-first-run',
                '--no-default-browser-check',
                '--remote-allow-origins=*',
                '--remote-debugging-port=0',
                `--user-data-dir=${profile}`,
                'about:blank',
            ],
            { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
        );
        const devtoolsUrl = await waitForDevtoolsUrl(browserProcess);
        cdp = await connectCdp(devtoolsUrl);

        console.log(`xqsql: browser ${basename(executable)}`);
        let failures = 0;
        for (const page of pages) {
            try {
                const result = await verifyPage(cdp, baseUrl, page);
                console.log(
                    `PASS ${page}: ${result.checks} checks, ${result.panel} SQL rows, ${result.width}px viewport, no overflow`,
                );
            } catch (error) {
                failures++;
                console.error(`FAIL ${page}: ${error.message}`);
            }
        }

        if (failures > 0) {
            process.exitCode = 1;
        } else {
            console.log('xqsql: all browser pages passed.');
        }
    } catch (error) {
        console.error(`xqsql: browser check failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        cdp?.close();
        if (browserProcess && browserProcess.exitCode === null) {
            const exited = new Promise((resolveExit) => browserProcess.once('exit', resolveExit));
            browserProcess.kill();
            await Promise.race([exited, sleep(3000)]);
        }
        await new Promise((resolveClose) => server.close(resolveClose));
        if (profile) {
            const resolvedProfile = resolve(profile);
            const resolvedTemp = resolve(tmpdir());
            if (resolvedProfile.startsWith(resolvedTemp + sep)) {
                let cleanupError;
                for (let attempt = 0; attempt < 5; attempt++) {
                    try {
                        await rm(resolvedProfile, { recursive: true, force: true });
                        cleanupError = null;
                        break;
                    } catch (error) {
                        cleanupError = error;
                        await sleep(200 * (attempt + 1));
                    }
                }
                if (cleanupError) {
                    console.warn(`xqsql: temporary browser profile was not fully removed: ${cleanupError.message}`);
                }
            }
        }
    }
}
