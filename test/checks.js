/* 迭代顺序显示：先清空再逐条追加，失败信息同时写进 #checks 与 #details。 */
(function (root) {
    'use strict';

    var doc = root.document;
    var state = { passed: 0, failed: 0, errors: [] };
    var panels = [];

    function create(tag, className, text) {
        var node = doc.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    function addRow(ok, title, detail) {
        var list = doc.getElementById('checks');
        var item = create('li', ok ? 'is-pass' : 'is-fail');
        item.appendChild(create('span', 'mark', ok ? 'PASS' : 'FAIL'));
        item.appendChild(create('span', 'title', title));
        if (!ok && detail) {
            item.appendChild(create('pre', 'detail', detail));
        }
        list.appendChild(item);
    }

    function record(ok, title, detail) {
        state[ok ? 'passed' : 'failed'] += 1;
        if (!ok) {
            state.errors.push(detail ? title + ' — ' + detail : title);
        }
        addRow(ok, title, detail);
    }

    function check(title, fn) {
        try {
            var value = fn();
            record(value !== false, title, value === false ? '断言函数返回 false' : '');
        } catch (error) {
            record(false, title, error && error.message ? error.message : String(error));
        }
    }

    function equal(title, actual, expected, panel) {
        var left = JSON.stringify(actual);
        var right = JSON.stringify(expected);
        var ok = left === right;
        record(ok, title, ok ? '' : '期望 ' + right + '，实际 ' + left);
        if (panel !== false && ok) {
            panels.push(Array.isArray(actual) ? actual.join(' ') : actual);
        }
    }

    function runCases(api, options) {
        var settings = options || {};
        var cases = root.xqsqlCases || [];

        cases.forEach(function (item) {
            var actual;
            try {
                actual = item.run(api);
            } catch (error) {
                actual = error && error.message ? error.message : String(error);
            }
            equal(settings.label ? settings.label + ' · ' + item.title : item.title, actual, item.expected, item.panel);
        });
    }

    function renderPanel(extra) {
        var list = doc.getElementById('results');
        list.innerHTML = '';
        var rows = (extra || []).concat(panels);
        rows.forEach(function (value) {
            list.appendChild(create('li', 'sql', typeof value === 'string' ? value : JSON.stringify(value)));
        });
    }

    function finish(api, label) {
        var ok = state.failed === 0 && state.errors.length === 0;

        root.__XQSQL_TEST__ = {
            status: ok ? 'passed' : 'failed',
            label: label || '',
            passed: state.passed,
            failed: state.failed,
            errors: state.errors.slice(),
        };
        // 页面必须留下可用实例：保留 API 供控制台继续调用，并把结果面板填满。
        root.__XQSQL_DEMO__ = { api: api, at: new Date().toISOString() };

        var summary = doc.getElementById('summary');
        summary.textContent = (ok ? 'PASS' : 'FAIL') + ' · ' + state.passed + ' passed, ' + state.failed + ' failed';
        summary.className = ok ? 'summary is-pass' : 'summary is-fail';

        doc.getElementById('details').textContent = state.passed + ' passed, ' + state.failed + ' failed'
            + (state.errors.length ? ' · ' + state.errors[0] : '');
        renderPanel();
        doc.body.setAttribute('data-status', ok ? 'passed' : 'failed');
    }

    root.XqChecks = {
        check: check,
        equal: equal,
        record: record,
        runCases: runCases,
        renderPanel: renderPanel,
        finish: finish,
        state: state,
    };
})(typeof self !== 'undefined' ? self : this);
