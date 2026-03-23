import React, { useEffect, useMemo, useState } from 'react';

/* ─── Constants ─── */

const CANVAS_MESSAGE_CHANNEL = 'simulation-canvas-v2';

const BASE_CSS = `
:root { color-scheme: light; font-family: "Inter", system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; background: #f8fafc; color: #0f172a; min-height: 100vh; }
#canvas-root { padding: 20px; }
/* ─ Built-in utility classes ─ */
.sim-title { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #1e293b; }
.sim-subtitle { margin: 0 0 16px; font-size: 13px; color: #64748b; }
.sim-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
.sim-btn {
  border: none; background: #2563eb; color: #fff; border-radius: 8px;
  padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.sim-btn:hover { background: #1d4ed8; }
.sim-btn.outline { background: transparent; border: 1.5px solid #cbd5e1; color: #334155; }
.sim-btn.outline:hover { border-color: #2563eb; color: #2563eb; }
.sim-btn.danger { background: #ef4444; }
.sim-btn.danger:hover { background: #dc2626; }
.sim-btn.success { background: #16a34a; }
.sim-btn.success:hover { background: #15803d; }
.sim-label { font-size: 12px; font-weight: 600; color: #64748b; display: inline-flex; align-items: center; gap: 6px; }
.sim-canvas, .sim-svg {
  width: 100%; border: 1px solid #e2e8f0; border-radius: 12px;
  background: #fff; display: block;
}
.sim-output { margin-top: 12px; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 13px; color: #334155; white-space: pre-wrap; font-family: "JetBrains Mono", "Fira Code", monospace; }
.sim-info { padding: 10px 14px; background: #eff6ff; border-radius: 8px; font-size: 13px; color: #1e40af; margin-top: 12px; }
.sim-grid { display: grid; gap: 8px; }
.sim-card { padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; }
.sim-card.active { border-color: #2563eb; background: #eff6ff; }
.sim-card.done { border-color: #16a34a; background: #f0fdf4; }
`;

const escapeHtml = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const serializeForScript = (value) =>
  JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

const sanitizeScript = (src) => String(src || '').replace(/<\/script/gi, '<\\/script');

const sanitizeLibs = (libs) => {
  if (!libs) return [];
  const arr = Array.isArray(libs) ? libs : String(libs).split('\n');
  return arr.map((s) => s.trim()).filter((s) => /^https?:\/\/\S+$/i.test(s));
};

/* ─── Build the iframe srcdoc ─── */

const buildSrcDoc = ({ html, css, js, libs, input, title, runKey, instanceId }) => {
  const libTags = sanitizeLibs(libs)
    .map((url) => `<script src="${escapeHtml(url)}"></script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>${BASE_CSS}\n${css || ''}</style>
  </head>
  <body>
    <div id="canvas-root">${html || '<div id="app"></div>'}</div>
    ${libTags}
    <script>
      (() => {
        const channel = "${CANVAS_MESSAGE_CHANNEL}";
        const runKey = ${Number(runKey) || 0};
        const instanceId = ${serializeForScript(instanceId)};

        const post = (type, payload = {}) => {
          try { window.parent.postMessage({ channel, type, runKey, instanceId, ...payload }, '*'); }
          catch (e) { console.error(e); }
        };

        window.addEventListener('error', (e) => post('error', { message: e?.message || 'Runtime error', stack: e?.error?.stack || '' }));
        window.addEventListener('unhandledrejection', (e) => {
          const r = e?.reason;
          post('error', { message: r?.message || String(r || 'Unhandled rejection'), stack: r?.stack || '' });
        });

        const context = Object.freeze({
          root: document.getElementById('canvas-root'),
          app: document.getElementById('app') || document.getElementById('canvas-root'),
          input: ${serializeForScript(input || {})},
          meta: Object.freeze({ title: ${serializeForScript(title || '')}, runKey }),
          helpers: Object.freeze({
            clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
            lerp: (a, b, t) => a + (b - a) * t,
            range: (n) => Array.from({ length: Math.max(0, n | 0) }, (_, i) => i),
            wait: (ms) => new Promise((r) => setTimeout(r, ms)),
            el: (tag, attrs, ...children) => {
              const e = document.createElement(tag);
              if (attrs) Object.entries(attrs).forEach(([k, v]) => {
                if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
                else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
                else e.setAttribute(k, v);
              });
              children.flat().forEach(c => {
                if (c == null) return;
                e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
              });
              return e;
            },
          }),
        });

        window.__simulationContext = context;

        try {
          const run = new Function('context', '"use strict";\\n' + ${serializeForScript(sanitizeScript(js || ''))});
          const result = run(context);
          if (result && typeof result.then === 'function') {
            result.then(() => post('ready')).catch((e) => post('error', { message: e?.message || String(e) }));
          } else {
            post('ready');
          }
        } catch (e) {
          post('error', { message: e?.message || String(e), stack: e?.stack || '' });
        }
      })();
    </script>
  </body>
</html>`;
};

/* ─── Parse content safely ─── */

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

const parseContent = (content) => {
  if (isObj(content)) return content;
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return isObj(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

/* ─── Migrate legacy content ─── */

const migrateContent = (raw) => {
  const data = parseContent(raw);

  // Already in new flat format
  if (typeof data.js === 'string' || typeof data.html === 'string') {
    return data;
  }

  // Migrate from canvasSandbox format
  if (isObj(data.canvasSandbox) && data.canvasSandbox.enabled) {
    const cs = data.canvasSandbox;
    return {
      title: data.title || '',
      description: data.description || '',
      hint: data.hint || '',
      solutionText: data.solutionText || '',
      html: cs.html || '',
      css: cs.css || '',
      js: cs.js || '',
      libs: cs.libs || [],
      height: cs.height || 420,
      inputJson: cs.inputJson || '{}',
    };
  }

  // Return whatever we have with sensible defaults
  return {
    title: data.title || '',
    description: data.description || '',
    hint: data.hint || '',
    solutionText: data.solutionText || '',
    html: data.html || '<div id="app"></div>',
    css: data.css || '',
    js: data.js || '// Write your simulation code here\nconst { app, input, helpers } = context;\napp.innerHTML = "<h3>Hello Simulation!</h3><p>Edit the code to build your visualization.</p>";',
    libs: data.libs || [],
    height: data.height || 420,
    inputJson: data.inputJson || '{}',
  };
};

/* ─── Parse input JSON ─── */

const parseInputJson = (value) => {
  if (isObj(value)) return { value, error: '' };
  if (typeof value !== 'string' || !value.trim()) return { value: {}, error: '' };
  try {
    return { value: JSON.parse(value), error: '' };
  } catch (e) {
    return { value: {}, error: e.message };
  }
};

/* ─────────────────────────────────────────── */
/*  Main Component                             */
/* ─────────────────────────────────────────── */

export default function InteractiveSimulationBlock({ block, compact = false }) {
  const sim = useMemo(() => migrateContent(block?.content), [block?.content]);

  const [runKey, setRunKey] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [frameStatus, setFrameStatus] = useState({
    instanceId: null,
    runKey: -1,
    runtimeError: '',
    isReady: false,
  });

  const instanceId = useMemo(
    () => `sim-${block?.id || block?.localId || 'block'}-${compact ? 'c' : 'f'}`,
    [block?.id, block?.localId, compact]
  );

  const inputResult = useMemo(() => parseInputJson(sim.inputJson), [sim.inputJson]);
  const frameHeight = Math.max(280, Number(sim.height) || 420);

  // Build srcdoc
  const srcDoc = useMemo(
    () =>
      buildSrcDoc({
        html: sim.html,
        css: sim.css,
        js: sim.js,
        libs: sim.libs,
        input: inputResult.value,
        title: sim.title,
        runKey,
        instanceId,
      }),
    [sim.html, sim.css, sim.js, sim.libs, inputResult.value, sim.title, runKey, instanceId]
  );

  const statusForCurrentRun =
    frameStatus.instanceId === instanceId && frameStatus.runKey === runKey
      ? frameStatus
      : { runtimeError: '', isReady: false };
  const runtimeError = statusForCurrentRun.runtimeError;
  const isReady = statusForCurrentRun.isReady;

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event) => {
      const d = event?.data;
      if (!isObj(d) || d.channel !== CANVAS_MESSAGE_CHANNEL) return;
      if (d.instanceId !== instanceId || d.runKey !== runKey) return;
      if (d.type === 'error') {
        setFrameStatus({
          instanceId,
          runKey,
          runtimeError: d.message || 'Runtime error',
          isReady: false,
        });
      } else if (d.type === 'ready') {
        setFrameStatus({
          instanceId,
          runKey,
          runtimeError: '',
          isReady: true,
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [instanceId, runKey]);

  const reset = () => {
    setRunKey((k) => k + 1);
  };

  return (
    <article className={`rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm overflow-hidden ${compact ? '' : ''}`}>
      {/* ── Header ── */}
      <header className="px-5 pt-5 pb-3 md:px-6 md:pt-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-sm">experiment</span>
              Interactive Simulation
            </p>
            {sim.title && (
              <h3 className="text-lg font-bold text-on-surface tracking-tight leading-snug">{sim.title}</h3>
            )}
            {sim.description && (
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{sim.description}</p>
            )}
          </div>
          {/* Status badge */}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${isReady ? 'bg-emerald-100 text-emerald-700' : runtimeError ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
            {isReady ? '● Running' : runtimeError ? '● Error' : '○ Loading'}
          </span>
        </div>
      </header>

      {/* ── Error display ── */}
      {runtimeError && (
        <div className="mx-5 md:mx-6 mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 font-mono">
          <p className="font-semibold text-xs uppercase tracking-wider mb-1 text-rose-500">Runtime Error</p>
          {runtimeError}
        </div>
      )}
      {inputResult.error && (
        <div className="mx-5 md:mx-6 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Input JSON error: {inputResult.error}
        </div>
      )}

      {/* ── Canvas iframe ── */}
      <div className="mx-5 md:mx-6 rounded-xl overflow-hidden border border-outline-variant/30 bg-white">
        {inputResult.error ? (
          <div className="flex items-center justify-center h-48 text-sm text-amber-600 italic">
            Fix input JSON to run this simulation.
          </div>
        ) : (
          <iframe
            key={`${instanceId}-${runKey}`}
            title={sim.title || 'Interactive simulation'}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
            className="w-full"
            style={{ height: `${frameHeight}px`, border: 0 }}
          />
        )}
      </div>

      {/* ── Controls ── */}
      <div className="px-5 md:px-6 py-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-xs font-bold text-primary hover:bg-primary/15 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Reset
        </button>

        {sim.hint && (
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${showHint ? 'border-amber-400/50 bg-amber-50 text-amber-700' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined text-sm">lightbulb</span>
            {showHint ? 'Hide Hint' : 'Hint'}
          </button>
        )}

        {sim.solutionText && (
          <button
            type="button"
            onClick={() => setShowSolution((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${showSolution ? 'border-secondary/40 bg-secondary/10 text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            {showSolution ? 'Hide Solution' : 'Solution'}
          </button>
        )}

        <span className="ml-auto text-[11px] text-outline font-medium">
          Isolated sandbox • Run #{runKey + 1}
        </span>
      </div>

      {/* ── Hint / Solution panels ── */}
      {showHint && sim.hint && (
        <div className="mx-5 md:mx-6 mb-4 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-in slide-in-from-top-2 duration-200">
          <p className="font-semibold text-xs uppercase tracking-wider mb-1 text-amber-600">Hint</p>
          {sim.hint}
        </div>
      )}
      {showSolution && sim.solutionText && (
        <div className="mx-5 md:mx-6 mb-4 rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-in slide-in-from-top-2 duration-200">
          <p className="font-semibold text-xs uppercase tracking-wider mb-1 text-emerald-600">Solution</p>
          {sim.solutionText}
        </div>
      )}

      {/* ── Footer ── */}
      {!compact && (
        <div className="px-5 md:px-6 pb-4">
          <p className="text-[11px] text-outline">
            This canvas runs inside an isolated browser sandbox.
          </p>
        </div>
      )}
    </article>
  );
}
