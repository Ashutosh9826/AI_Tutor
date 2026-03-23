import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

/* ─── Constants ─── */

const CODE_MESSAGE_CHANNEL = 'code-notebook-v1';

const BASE_CSS = `
:root { color-scheme: light; font-family: system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; background: #1e1e2e; color: #cdd6f4; min-height: 100vh; }
#output-container {
  padding: 12px 16px;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.log { color: #cdd6f4; }
.warn { color: #f9e2af; }
.error { color: #f38ba8; font-weight: 600; }
.info { color: #89b4fa; }
.table-wrap { overflow-x: auto; margin: 4px 0; }
.table-wrap table {
  border-collapse: collapse;
  font-size: 12px;
  min-width: 120px;
}
.table-wrap th, .table-wrap td {
  border: 1px solid #45475a;
  padding: 3px 8px;
  text-align: left;
}
.table-wrap th { background: #313244; color: #89b4fa; font-weight: 600; }
.table-wrap td { background: #1e1e2e; }
.html-output { padding: 16px; background: #fff; color: #1e293b; font-family: system-ui, sans-serif; }
.separator { border-top: 1px solid #313244; margin: 6px 0; }
.time { color: #6c7086; font-size: 11px; margin-top: 8px; }
`;

const serializeForScript = (value) =>
  JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

const sanitizeScript = (src) => String(src || '').replace(/<\/script/gi, '<\\/script');

/* ─── Build iframe srcdoc ─── */

const buildSrcDoc = ({ code, runKey, instanceId }) => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>${BASE_CSS}</style>
  </head>
  <body>
    <div id="output-container"></div>
    <script>
      (() => {
        const channel = "${CODE_MESSAGE_CHANNEL}";
        const runKey = ${Number(runKey) || 0};
        const instanceId = ${serializeForScript(instanceId)};
        const outputEl = document.getElementById('output-container');
        const startTime = performance.now();

        const post = (type, payload = {}) => {
          try { window.parent.postMessage({ channel, type, runKey, instanceId, ...payload }, '*'); }
          catch (e) {}
        };

        const escapeHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        const formatValue = (v) => {
          if (v === undefined) return 'undefined';
          if (v === null) return 'null';
          if (typeof v === 'object') {
            try { return JSON.stringify(v, null, 2); } catch { return String(v); }
          }
          return String(v);
        };

        const appendOutput = (text, className) => {
          const div = document.createElement('div');
          div.className = className;
          div.textContent = text;
          outputEl.appendChild(div);
          post('output', { text, className });
        };

        const renderTable = (data) => {
          if (!Array.isArray(data) || data.length === 0) return;
          const wrap = document.createElement('div');
          wrap.className = 'table-wrap';
          const table = document.createElement('table');
          const keys = Object.keys(data[0] || {});

          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          // Index column
          const idxTh = document.createElement('th');
          idxTh.textContent = '(index)';
          headerRow.appendChild(idxTh);
          keys.forEach(k => { const th = document.createElement('th'); th.textContent = k; headerRow.appendChild(th); });
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          data.forEach((row, i) => {
            const tr = document.createElement('tr');
            const idxTd = document.createElement('td');
            idxTd.textContent = i;
            tr.appendChild(idxTd);
            keys.forEach(k => { const td = document.createElement('td'); td.textContent = formatValue(row[k]); tr.appendChild(td); });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          wrap.appendChild(table);
          outputEl.appendChild(wrap);
        };

        // Override console methods
        const origConsole = { ...console };

        console.log = (...args) => {
          origConsole.log(...args);
          appendOutput(args.map(formatValue).join(' '), 'log');
        };
        console.warn = (...args) => {
          origConsole.warn(...args);
          appendOutput(args.map(formatValue).join(' '), 'warn');
        };
        console.error = (...args) => {
          origConsole.error(...args);
          appendOutput(args.map(formatValue).join(' '), 'error');
        };
        console.info = (...args) => {
          origConsole.info(...args);
          appendOutput(args.map(formatValue).join(' '), 'info');
        };
        console.table = (data) => {
          origConsole.table(data);
          if (Array.isArray(data)) renderTable(data);
          else appendOutput(formatValue(data), 'log');
        };
        console.clear = () => {
          origConsole.clear();
          outputEl.innerHTML = '';
        };

        window.addEventListener('error', (e) => {
          appendOutput(e?.message || 'Runtime error', 'error');
          post('error', { message: e?.message || 'Runtime error' });
        });

        window.addEventListener('unhandledrejection', (e) => {
          const msg = e?.reason?.message || String(e?.reason || 'Unhandled promise rejection');
          appendOutput(msg, 'error');
          post('error', { message: msg });
        });

        try {
          const run = new Function('"use strict";\\n' + ${serializeForScript(sanitizeScript(code || ''))});
          const result = run();
          if (result && typeof result.then === 'function') {
            result
              .then((v) => {
                if (v !== undefined) appendOutput(formatValue(v), 'log');
                const elapsed = (performance.now() - startTime).toFixed(1);
                appendOutput('Executed in ' + elapsed + 'ms', 'time');
                post('done', { elapsed });
              })
              .catch((e) => {
                appendOutput(e?.message || String(e), 'error');
                post('error', { message: e?.message || String(e) });
              });
          } else {
            if (result !== undefined) appendOutput(formatValue(result), 'log');
            const elapsed = (performance.now() - startTime).toFixed(1);
            appendOutput('Executed in ' + elapsed + 'ms', 'time');
            post('done', { elapsed });
          }
        } catch (e) {
          appendOutput(e?.message || String(e), 'error');
          post('error', { message: e?.message || String(e), stack: e?.stack || '' });
        }
      })();
    </script>
  </body>
</html>`;
};

/* ─────────────────────────────────────────── */
/*  Main Component                             */
/* ─────────────────────────────────────────── */

export default function CodeNotebookBlock({
  code,
  onChange,
  editable = false,
  blockId,
}) {
  const [runKey, setRunKey] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef(null);

  const instanceId = `code-${blockId || 'block'}`;

  const srcDoc = useMemo(
    () => (hasRun ? buildSrcDoc({ code, runKey, instanceId }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runKey, hasRun]
  );

  // Listen for iframe messages
  useEffect(() => {
    const handler = (event) => {
      const d = event?.data;
      if (!d || d.channel !== CODE_MESSAGE_CHANNEL) return;
      if (d.instanceId !== instanceId) return;
      if (d.runKey !== runKey) return;

      if (d.type === 'done') {
        setIsRunning(false);
        setElapsed(d.elapsed || null);
      } else if (d.type === 'error') {
        setIsRunning(false);
        setHasError(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [instanceId, runKey]);

  const handleRun = useCallback(() => {
    setHasError(false);
    setElapsed(null);
    setIsRunning(true);
    setHasRun(true);
    setRunKey((k) => k + 1);
  }, []);

  const handleClear = useCallback(() => {
    setHasRun(false);
    setHasError(false);
    setElapsed(null);
    setIsRunning(false);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      // Shift+Enter to run
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        handleRun();
      }
      // Tab inserts 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const value = target.value;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        if (onChange) onChange(newValue);
        // Restore cursor
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
    },
    [handleRun, onChange]
  );

  const lineCount = (code || '').split('\n').length;

  return (
    <div className="rounded-xl overflow-hidden border border-[#313244] bg-[#1e1e2e] shadow-sm">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-[#313244]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#f38ba8]"></span>
            <span className="w-3 h-3 rounded-full bg-[#f9e2af]"></span>
            <span className="w-3 h-3 rounded-full bg-[#a6e3a1]"></span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#6c7086]">
            JavaScript
          </span>
        </div>
        <div className="flex items-center gap-2">
          {elapsed && !isRunning && (
            <span className="text-[10px] text-[#6c7086] font-mono">{elapsed}ms</span>
          )}
          {hasRun && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#a6e3a1] text-[#1e1e2e] text-xs font-bold hover:bg-[#94e2d5] transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">
              {isRunning ? 'hourglass_top' : 'play_arrow'}
            </span>
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* ── Code editor ── */}
      <div className="relative">
        {/* Line numbers */}
        <div
          className="absolute left-0 top-0 bottom-0 w-12 bg-[#181825] border-r border-[#313244] select-none pointer-events-none pt-4 text-right pr-2"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="text-[12px] leading-[1.6] font-mono text-[#45475a]">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          className="w-full bg-transparent text-[#cdd6f4] pl-14 pr-4 py-4 outline-none font-mono text-[13px] leading-[1.6] resize-y min-h-[64px]"
          style={{ minHeight: Math.max(64, lineCount * 21 + 32) }}
          placeholder="// Write JavaScript code here..."
          value={code || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={!editable}
          spellCheck={false}
        />
      </div>

      {/* ── Output area ── */}
      {hasRun && (
        <div className="border-t border-[#313244]">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#181825]">
            <span className="material-symbols-outlined text-sm text-[#6c7086]">terminal</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6c7086]">
              Output
            </span>
            {hasError && (
              <span className="text-[10px] font-bold text-[#f38ba8] ml-1">● Error</span>
            )}
          </div>
          {srcDoc && (
            <iframe
              ref={iframeRef}
              key={`${instanceId}-${runKey}`}
              title="Code output"
              srcDoc={srcDoc}
              sandbox="allow-scripts"
              className="w-full"
              style={{
                height: '180px',
                border: 0,
                background: '#1e1e2e',
              }}
            />
          )}
        </div>
      )}

      {/* ── Keyboard hint ── */}
      {editable && (
        <div className="px-4 py-1.5 bg-[#181825] border-t border-[#313244] flex items-center justify-between">
          <span className="text-[10px] text-[#45475a]">
            <kbd className="px-1 py-0.5 bg-[#313244] text-[#6c7086] rounded text-[9px] font-mono">Shift</kbd>
            {' + '}
            <kbd className="px-1 py-0.5 bg-[#313244] text-[#6c7086] rounded text-[9px] font-mono">Enter</kbd>
            {' to run'}
          </span>
          <span className="text-[10px] text-[#45475a]">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
