import React, { useEffect, useMemo, useState } from 'react';

const CANVAS_MESSAGE_CHANNEL = 'simulation-canvas-v3';

const BASE_CSS = `
:root {
  color-scheme: light;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f8fafc;
  color: #0f172a;
  min-height: 100vh;
}
#canvas-root {
  padding: 20px;
}
.sim-title { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #1e293b; }
.sim-subtitle { margin: 0 0 14px; font-size: 13px; color: #64748b; }
.sim-controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.sim-btn {
  border: none;
  background: #2563eb;
  color: #ffffff;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.sim-btn:hover { background: #1d4ed8; }
.sim-btn.outline {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
}
.sim-btn.outline:hover { border-color: #2563eb; color: #2563eb; }
.sim-canvas,
.sim-svg {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  display: block;
}
.sim-output {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #334155;
  font-size: 13px;
  white-space: pre-wrap;
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
}
`;

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const serializeForScript = (value) =>
  JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

const sanitizeScript = (source) => String(source || '').replace(/<\/script/gi, '<\\/script');

const sanitizeLibs = (libs) => {
  if (!libs) return [];
  const list = Array.isArray(libs) ? libs : String(libs).split('\n');
  return list.map((item) => item.trim()).filter((item) => /^https?:\/\/\S+$/i.test(item));
};

const parseContent = (content) => {
  if (isObject(content)) return content;
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const migrateContent = (rawContent) => {
  const parsed = parseContent(rawContent);

  if (typeof parsed.js === 'string' || typeof parsed.html === 'string') {
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      hint: parsed.hint || '',
      solutionText: parsed.solutionText || '',
      html: parsed.html || '<div id="app"></div>',
      css: parsed.css || '',
      js:
        parsed.js ||
        '// Use context.app, context.input, and context.helpers\nconst { app, input, helpers } = context;\nhelpers.setState({ started: true, input });\napp.innerHTML = `<h3>Interactive Simulation</h3><p>Update this code to visualize your topic.</p>`;',
      libs: Array.isArray(parsed.libs) ? parsed.libs : [],
      height: Number(parsed.height) > 0 ? Number(parsed.height) : 420,
      inputJson: typeof parsed.inputJson === 'string' ? parsed.inputJson : JSON.stringify(parsed.inputJson ?? {}),
    };
  }

  if (isObject(parsed.canvasSandbox) && parsed.canvasSandbox.enabled) {
    const canvas = parsed.canvasSandbox;
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      hint: parsed.hint || '',
      solutionText: parsed.solutionText || '',
      html: canvas.html || '<div id="app"></div>',
      css: canvas.css || '',
      js: canvas.js || '',
      libs: Array.isArray(canvas.libs) ? canvas.libs : [],
      height: Number(canvas.height) > 0 ? Number(canvas.height) : 420,
      inputJson: typeof canvas.inputJson === 'string' ? canvas.inputJson : JSON.stringify(canvas.inputJson ?? {}),
    };
  }

  return {
    title: parsed.title || '',
    description: parsed.description || '',
    hint: parsed.hint || '',
    solutionText: parsed.solutionText || '',
    html: '<div id="app"></div>',
    css: '',
    js:
      '// Use context.app, context.input, and context.helpers\nconst { app, input, helpers } = context;\nhelpers.setState({ started: true, input });\napp.innerHTML = `<h3>Interactive Simulation</h3><p>Update this code to visualize your topic.</p>`;',
    libs: [],
    height: 420,
    inputJson: '{}',
  };
};

const parseInputJson = (value) => {
  if (isObject(value)) return { value, error: '' };
  if (typeof value !== 'string' || !value.trim()) return { value: {}, error: '' };

  try {
    return { value: JSON.parse(value), error: '' };
  } catch (error) {
    return { value: {}, error: error.message || 'Invalid JSON input.' };
  }
};

const compactJson = (value) => {
  try {
    const json = JSON.stringify(value);
    if (json.length <= 90) return json;
    return `${json.slice(0, 87)}...`;
  } catch {
    return String(value);
  }
};

const prettyJson = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildSrcDoc = ({ html, css, js, libs, input, title, runKey, instanceId }) => {
  const scriptTags = sanitizeLibs(libs)
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
    ${scriptTags}
    <script>
      (() => {
        const channel = "${CANVAS_MESSAGE_CHANNEL}";
        const runKey = ${Number(runKey) || 0};
        const instanceId = ${serializeForScript(instanceId)};

        const post = (type, payload = {}) => {
          try {
            window.parent.postMessage({ channel, type, runKey, instanceId, ...payload }, '*');
          } catch (error) {
            // no-op
          }
        };

        const toPlainObject = (value) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return { value };
          }
          return value;
        };

        let stateSnapshot = toPlainObject(${serializeForScript(input || {})});

        const pushState = (nextState, label) => {
          stateSnapshot = toPlainObject(nextState);
          post('state', { state: stateSnapshot, label: label || 'state update', timestamp: Date.now() });
          return stateSnapshot;
        };

        const mergeState = (patch, label) => {
          if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
            stateSnapshot = { ...stateSnapshot, ...patch };
          } else {
            stateSnapshot = { ...stateSnapshot, value: patch };
          }
          post('state', { state: stateSnapshot, label: label || 'state update', timestamp: Date.now() });
          return stateSnapshot;
        };

        const formatLogValue = (value) => {
          if (typeof value === 'string') return value;
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        };

        const log = (...values) => {
          post('log', {
            message: values.map(formatLogValue).join(' '),
            timestamp: Date.now(),
          });
        };

        const context = Object.freeze({
          root: document.getElementById('canvas-root'),
          app: document.getElementById('app') || document.getElementById('canvas-root'),
          input: ${serializeForScript(input || {})},
          meta: Object.freeze({ title: ${serializeForScript(title || '')}, runKey }),
          helpers: Object.freeze({
            clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
            lerp: (start, end, t) => start + (end - start) * t,
            range: (count) => Array.from({ length: Math.max(0, count | 0) }, (_item, index) => index),
            wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
            el: (tag, attrs, ...children) => {
              const element = document.createElement(tag);
              if (attrs && typeof attrs === 'object') {
                Object.entries(attrs).forEach(([key, value]) => {
                  if (key === 'style' && value && typeof value === 'object') {
                    Object.assign(element.style, value);
                    return;
                  }
                  if (key.startsWith('on') && typeof value === 'function') {
                    element.addEventListener(key.slice(2).toLowerCase(), value);
                    return;
                  }
                  element.setAttribute(key, value);
                });
              }
              children.flat().forEach((child) => {
                if (child === null || child === undefined) return;
                element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
              });
              return element;
            },
            setState: (patch, label = 'state updated') => mergeState(patch, label),
            replaceState: (nextState, label = 'state replaced') => pushState(nextState, label),
            getState: () => JSON.parse(JSON.stringify(stateSnapshot)),
            emitStep: (label, payload = {}) => post('step', { label: label || 'step', payload, timestamp: Date.now() }),
            log,
          }),
        });

        window.__simulationContext = context;

        pushState(stateSnapshot, 'initial');

        window.addEventListener('error', (event) => {
          post('error', {
            message: event?.message || 'Runtime error',
            stack: event?.error?.stack || '',
          });
        });

        window.addEventListener('unhandledrejection', (event) => {
          const reason = event?.reason;
          post('error', {
            message: reason?.message || String(reason || 'Unhandled rejection'),
            stack: reason?.stack || '',
          });
        });

        try {
          const execute = new Function('context', '"use strict";\\n' + ${serializeForScript(sanitizeScript(js || ''))});
          const result = execute(context);

          if (result && typeof result.then === 'function') {
            result
              .then(() => post('ready'))
              .catch((error) => {
                post('error', {
                  message: error?.message || String(error),
                  stack: error?.stack || '',
                });
              });
          } else {
            post('ready');
          }
        } catch (error) {
          post('error', {
            message: error?.message || String(error),
            stack: error?.stack || '',
          });
        }
      })();
    </script>
  </body>
</html>`;
};

export default function InteractiveSimulationBlock({ block, compact = false }) {
  const simulation = useMemo(() => migrateContent(block?.content), [block?.content]);

  const [runKey, setRunKey] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showStatePanel, setShowStatePanel] = useState(true);
  const [frameStatus, setFrameStatus] = useState({
    instanceId: null,
    runKey: -1,
    runtimeError: '',
    isReady: false,
  });
  const [stateSnapshot, setStateSnapshot] = useState({});
  const [stateTimeline, setStateTimeline] = useState([]);
  const [runtimeMessages, setRuntimeMessages] = useState([]);

  const instanceId = useMemo(
    () => `sim-${block?.id || block?.localId || 'block'}-${compact ? 'compact' : 'full'}`,
    [block?.id, block?.localId, compact]
  );

  const inputResult = useMemo(() => parseInputJson(simulation.inputJson), [simulation.inputJson]);
  const frameHeight = Math.max(280, Number(simulation.height) || 420);

  const srcDoc = useMemo(
    () =>
      buildSrcDoc({
        html: simulation.html,
        css: simulation.css,
        js: simulation.js,
        libs: simulation.libs,
        input: inputResult.value,
        title: simulation.title,
        runKey,
        instanceId,
      }),
    [inputResult.value, instanceId, runKey, simulation.css, simulation.html, simulation.js, simulation.libs, simulation.title]
  );

  const currentFrameStatus =
    frameStatus.instanceId === instanceId && frameStatus.runKey === runKey
      ? frameStatus
      : { runtimeError: '', isReady: false };

  const runtimeError = currentFrameStatus.runtimeError;
  const isReady = currentFrameStatus.isReady;

  useEffect(() => {
    const handler = (event) => {
      const data = event?.data;
      if (!isObject(data) || data.channel !== CANVAS_MESSAGE_CHANNEL) return;
      if (data.instanceId !== instanceId || data.runKey !== runKey) return;

      if (data.type === 'error') {
        setFrameStatus({
          instanceId,
          runKey,
          runtimeError: data.message || 'Runtime error',
          isReady: false,
        });
        return;
      }

      if (data.type === 'ready') {
        setFrameStatus({
          instanceId,
          runKey,
          runtimeError: '',
          isReady: true,
        });
        return;
      }

      if (data.type === 'state') {
        const snapshot = isObject(data.state) ? data.state : { value: data.state };
        setStateSnapshot(snapshot);
        setStateTimeline((previous) => {
          const next = [
            ...previous,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              label: data.label || 'state update',
              timestamp: Number(data.timestamp) || Date.now(),
              snapshot,
            },
          ];
          return next.slice(-30);
        });
        return;
      }

      if (data.type === 'step') {
        setStateTimeline((previous) => {
          const next = [
            ...previous,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              label: data.label || 'step',
              timestamp: Number(data.timestamp) || Date.now(),
              snapshot: isObject(data.payload) ? data.payload : { value: data.payload },
            },
          ];
          return next.slice(-30);
        });
        return;
      }

      if (data.type === 'log') {
        setRuntimeMessages((previous) => {
          const next = [
            ...previous,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              message: data.message || '',
              timestamp: Number(data.timestamp) || Date.now(),
            },
          ];
          return next.slice(-25);
        });
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [instanceId, runKey]);

  const resetSimulation = () => {
    setRunKey((value) => value + 1);
    setFrameStatus({
      instanceId: null,
      runKey: -1,
      runtimeError: '',
      isReady: false,
    });
    setStateSnapshot({});
    setStateTimeline([]);
    setRuntimeMessages([]);
  };

  const clearStateView = () => {
    setStateSnapshot({});
    setStateTimeline([]);
    setRuntimeMessages([]);
  };

  return (
    <article className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm overflow-hidden">
      <header className="px-5 pt-5 pb-3 md:px-6 md:pt-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-sm">experiment</span>
              Interactive Simulation
            </p>
            {simulation.title && <h3 className="text-lg font-bold text-on-surface tracking-tight leading-snug">{simulation.title}</h3>}
            {simulation.description && <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{simulation.description}</p>}
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
              isReady
                ? 'bg-emerald-100 text-emerald-700'
                : runtimeError
                ? 'bg-rose-100 text-rose-700'
                : 'bg-sky-100 text-sky-700'
            }`}
          >
            {isReady ? 'Running' : runtimeError ? 'Error' : 'Loading'}
          </span>
        </div>
      </header>

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

      <div className="mx-5 md:mx-6 rounded-xl overflow-hidden border border-outline-variant/30 bg-white">
        {inputResult.error ? (
          <div className="flex items-center justify-center h-48 text-sm text-amber-600 italic">
            Fix input JSON to run this simulation.
          </div>
        ) : (
          <iframe
            key={`${instanceId}-${runKey}`}
            title={simulation.title || 'Interactive simulation'}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            className="w-full"
            style={{ height: `${frameHeight}px`, border: 0 }}
          />
        )}
      </div>

      <div className="px-5 md:px-6 py-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resetSimulation}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-xs font-bold text-primary hover:bg-primary/15 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Reset
        </button>

        {simulation.hint && (
          <button
            type="button"
            onClick={() => setShowHint((value) => !value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              showHint
                ? 'border-amber-400/50 bg-amber-50 text-amber-700'
                : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-sm">lightbulb</span>
            {showHint ? 'Hide Hint' : 'Hint'}
          </button>
        )}

        {simulation.solutionText && (
          <button
            type="button"
            onClick={() => setShowSolution((value) => !value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              showSolution
                ? 'border-secondary/40 bg-secondary/10 text-secondary'
                : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            {showSolution ? 'Hide Solution' : 'Solution'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowStatePanel((value) => !value)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          {showStatePanel ? 'Hide State' : 'Show State'}
        </button>

        <button
          type="button"
          onClick={clearStateView}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-sm">ink_eraser</span>
          Clear State View
        </button>

        <span className="ml-auto text-[11px] text-outline font-medium">Sandboxed run #{runKey + 1}</span>
      </div>

      {showHint && simulation.hint && (
        <div className="mx-5 md:mx-6 mb-4 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold text-xs uppercase tracking-wider mb-1 text-amber-600">Hint</p>
          {simulation.hint}
        </div>
      )}

      {showSolution && simulation.solutionText && (
        <div className="mx-5 md:mx-6 mb-4 rounded-xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold text-xs uppercase tracking-wider mb-1 text-emerald-600">Solution</p>
          {simulation.solutionText}
        </div>
      )}

      {showStatePanel && (
        <div className="mx-5 md:mx-6 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-outline">Current State</p>
              <span className="text-[10px] text-outline">{stateTimeline.length} updates</span>
            </div>
            <pre className="text-[11px] leading-relaxed text-on-surface whitespace-pre-wrap break-words font-mono max-h-48 overflow-auto">
              {prettyJson(stateSnapshot)}
            </pre>
          </section>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-outline mb-2">State Timeline</p>
            {stateTimeline.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No state updates yet. Use <code>context.helpers.setState()</code> in simulation code.
              </p>
            ) : (
              <div className="max-h-48 overflow-auto space-y-2">
                {stateTimeline.slice().reverse().map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-outline-variant/25 bg-white/60 px-3 py-2">
                    <p className="text-[11px] font-semibold text-on-surface">{entry.label}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                    <p className="text-[10px] text-on-surface-variant font-mono mt-1 break-words">{compactJson(entry.snapshot)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-widest text-outline mb-2">Runtime Notes</p>
            {runtimeMessages.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No runtime notes yet. Use <code>context.helpers.log()</code> to explain transitions.</p>
            ) : (
              <div className="max-h-32 overflow-auto space-y-1.5">
                {runtimeMessages.map((entry) => (
                  <p key={entry.id} className="text-[11px] text-on-surface-variant font-mono break-words">
                    [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.message}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!compact && (
        <div className="px-5 md:px-6 pb-4">
          <p className="text-[11px] text-outline">
            This simulation runs in an isolated sandbox and exposes built-in helpers for state visualization.
          </p>
        </div>
      )}
    </article>
  );
}
