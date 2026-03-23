import React, { useEffect, useMemo, useState } from 'react';

const GRAPH_LIKE_TYPES = new Set([
  'FLOWCHART',
  'GRAPH',
  'TREE',
  'STATE_MACHINE',
  'STEP_PROCESS',
  'ALGORITHM',
  'DECISION_DIAGRAM',
  'RECURSION_TREE',
  'SYSTEM_ARCHITECTURE',
]);

const DIAGRAM_LABELS = {
  FLOWCHART: 'Flowchart',
  GRAPH: 'Graph',
  TREE: 'Tree',
  STATE_MACHINE: 'State Machine',
  STEP_PROCESS: 'Step-by-step Process',
  ALGORITHM: 'Algorithm Visualization',
  TIMELINE: 'Timeline',
  DECISION_DIAGRAM: 'Decision Diagram',
  DP_TABLE: 'DP Table',
  RECURSION_TREE: 'Recursion Tree',
  SYSTEM_ARCHITECTURE: 'System Architecture',
};

const DEFAULT_SANDBOX_CODE = `const { input, helpers } = context;

const rawNodes = Array.isArray(input.nodes) && input.nodes.length > 0
  ? input.nodes
  : [
      { id: '1', label: '1', caption: 'a', role: 'source', x: 0.12, y: 0.78 },
      { id: '2', label: '2', x: 0.42, y: 0.82 },
      { id: '3', label: '3', x: 0.40, y: 0.50 },
      { id: '4', label: '4', x: 0.88, y: 0.48 },
      { id: '5', label: '5', caption: 'b', x: 0.55, y: 0.16 },
      { id: '6', label: '6', x: 0.17, y: 0.24 },
    ];

const nodes = rawNodes.map((node, index) => {
  if (typeof node === 'string' || typeof node === 'number') {
    const id = String(node);
    return {
      id,
      label: id,
      caption: '',
      x: 0.12 + (index % 3) * 0.35,
      y: 0.2 + Math.floor(index / 3) * 0.3,
    };
  }
  const id = String(node.id ?? node.label ?? index + 1);
  return {
    id,
    label: String(node.label ?? id),
    caption: String(node.caption ?? ''),
    role: String(node.role ?? ''),
    x: typeof node.x === 'number' ? node.x : 0.5,
    y: typeof node.y === 'number' ? node.y : 0.5,
  };
});

const edgeList = Array.isArray(input.edges) && input.edges.length > 0
  ? input.edges
  : [
      { from: '1', to: '2', weight: 7 },
      { from: '1', to: '3', weight: 9 },
      { from: '1', to: '6', weight: 14 },
      { from: '2', to: '3', weight: 10 },
      { from: '2', to: '4', weight: 15 },
      { from: '3', to: '4', weight: 11 },
      { from: '3', to: '6', weight: 2 },
      { from: '4', to: '5', weight: 6 },
      { from: '5', to: '6', weight: 9 },
    ];

const start = String(input.start || nodes[0].id);
const target = String(input.target || nodes[nodes.length - 1].id);

const adjacency = new Map();
nodes.forEach((node) => adjacency.set(node.id, []));
edgeList.forEach((edge) => {
  const from = String(edge.from);
  const to = String(edge.to);
  const weight = Number(edge.weight ?? 0);
  if (!adjacency.has(from)) adjacency.set(from, []);
  if (!adjacency.has(to)) adjacency.set(to, []);
  adjacency.get(from).push({ from, to, weight });
  if (edge.bidirectional !== false) {
    adjacency.get(to).push({ from: to, to: from, weight });
  }
});

const dist = {};
const prev = {};
const visited = new Set();
nodes.forEach((node) => {
  dist[node.id] = Infinity;
  prev[node.id] = null;
});
dist[start] = 0;

const steps = [];
steps.push({
  title: 'Initialize Distances',
  explanation: 'Set all node distances to Infinity except the source node.',
  activeNodes: [start],
  activeEdges: [],
  stateValues: {
    start,
    target,
    distances: { ...dist },
    visited: [],
  },
});

while (visited.size < nodes.length) {
  let current = null;
  let bestDistance = Infinity;

  nodes.forEach((node) => {
    if (!visited.has(node.id) && dist[node.id] < bestDistance) {
      bestDistance = dist[node.id];
      current = node.id;
    }
  });

  if (!current || bestDistance === Infinity) break;
  visited.add(current);

  steps.push({
    title: 'Visit ' + current,
    explanation: 'Select the unvisited node with the smallest tentative distance.',
    activeNodes: [current],
    activeEdges: [],
    stateValues: {
      current,
      distances: { ...dist },
      visited: [...visited],
    },
  });

  const neighbors = adjacency.get(current) || [];
  neighbors.forEach((edge) => {
    const nextDistance = dist[current] + edge.weight;
    if (nextDistance < (dist[edge.to] ?? Infinity)) {
      dist[edge.to] = nextDistance;
      prev[edge.to] = current;

      steps.push({
        title: 'Relax ' + edge.from + ' -> ' + edge.to,
        explanation: 'Update shortest-known distance to node ' + edge.to + '.',
        activeNodes: [edge.from, edge.to],
        activeEdges: [helpers.edgeId(edge.from, edge.to)],
        stateValues: {
          current,
          updatedNode: edge.to,
          distances: { ...dist },
          visited: [...visited],
        },
      });
    }
  });
}

const path = [];
let cursor = target;
while (cursor) {
  path.unshift(cursor);
  cursor = prev[cursor];
}

const pathEdges = [];
for (let i = 0; i < path.length - 1; i += 1) {
  pathEdges.push(helpers.edgeId(path[i], path[i + 1]));
}

if (path.length > 1 && path[0] === start) {
  steps.push({
    title: 'Shortest Path Found',
    explanation: 'Backtrack predecessor links to show the final shortest route.',
    activeNodes: path,
    activeEdges: pathEdges,
    annotation: "That's all!",
    stateValues: {
      path,
      totalCost: dist[target],
      visited: [...visited],
      distances: { ...dist },
      message: "That's all!",
    },
  });
}

return {
  title: 'Dijkstra Interactive Animation',
  diagramType: 'GRAPH',
  description: 'Video-style shortest-path visualization with distance labels and Out states.',
  hint: 'Red nodes are finalized (Out). Blue values show current best distances.',
  solutionText:
    path.length > 1 && path[0] === start
      ? 'Shortest path to ' + target + ': ' + path.join(' -> ') + ' (cost ' + dist[target] + ')'
      : 'No path found from ' + start + ' to ' + target + '.',
  canvas: { width: 560, height: 400, nodeRadius: 18, padding: 28 },
  nodes,
  edges: edgeList.map((edge) => ({
    id: helpers.edgeId(String(edge.from), String(edge.to)),
    from: String(edge.from),
    to: String(edge.to),
    label: String(edge.weight ?? ''),
  })),
  steps,
};`;

const fallbackSimulation = {
  title: 'Interactive Simulation Sandbox',
  diagramType: 'GRAPH',
  description: 'Run this sandbox to generate interactive steps and visuals.',
  hint: 'Edit code and input in Lesson Editor to simulate any process.',
  nodes: [],
  edges: [],
  steps: [
    {
      title: 'Waiting for Program',
      explanation: 'Enable sandbox mode and run a simulation script.',
      activeNodes: [],
      activeEdges: [],
      stateValues: {},
    },
  ],
  solutionText: 'Program output appears after running sandbox code.',
  sandbox: {
    enabled: true,
    code: DEFAULT_SANDBOX_CODE,
    inputJson: JSON.stringify(
      {
        start: '1',
        target: '5',
        nodes: [
          { id: '1', label: '1', caption: 'a', role: 'source', x: 0.12, y: 0.78 },
          { id: '2', label: '2', x: 0.42, y: 0.82 },
          { id: '3', label: '3', x: 0.40, y: 0.50 },
          { id: '4', label: '4', x: 0.88, y: 0.48 },
          { id: '5', label: '5', caption: 'b', x: 0.55, y: 0.16 },
          { id: '6', label: '6', x: 0.17, y: 0.24 },
        ],
        edges: [
          { from: '1', to: '2', weight: 7 },
          { from: '1', to: '3', weight: 9 },
          { from: '1', to: '6', weight: 14 },
          { from: '2', to: '3', weight: 10 },
          { from: '2', to: '4', weight: 15 },
          { from: '3', to: '4', weight: 11 },
          { from: '3', to: '6', weight: 2 },
          { from: '4', to: '5', weight: 6 },
          { from: '5', to: '6', weight: 9 },
        ],
      },
      null,
      2
    ),
  },
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseMaybeJson = (value) => {
  if (isPlainObject(value) || Array.isArray(value)) {
    return { value, error: '' };
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return { value: {}, error: '' };
  }
  try {
    return { value: JSON.parse(value), error: '' };
  } catch (error) {
    return { value: {}, error: error.message };
  }
};

const safeParseSimulation = (content) => {
  if (!content) return { ...fallbackSimulation };

  if (isPlainObject(content)) {
    return {
      ...fallbackSimulation,
      ...content,
      sandbox: {
        ...fallbackSimulation.sandbox,
        ...(isPlainObject(content.sandbox) ? content.sandbox : {}),
      },
    };
  }

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (!isPlainObject(parsed)) return { ...fallbackSimulation };
      return {
        ...fallbackSimulation,
        ...parsed,
        sandbox: {
          ...fallbackSimulation.sandbox,
          ...(isPlainObject(parsed.sandbox) ? parsed.sandbox : {}),
        },
      };
    } catch (error) {
      return { ...fallbackSimulation };
    }
  }

  return { ...fallbackSimulation };
};

const edgeId = (edge) => edge.id || `${edge.from}->${edge.to}`;

const renderStateValue = (value) => {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildSandboxHelpers = () => ({
  range: (start, end, step = 1) => {
    let from = start;
    let to = end;
    if (end === undefined) {
      from = 0;
      to = start;
    }
    if (step === 0) return [];
    const values = [];
    if (from <= to) {
      for (let i = from; i < to; i += Math.abs(step)) values.push(i);
    } else {
      for (let i = from; i > to; i -= Math.abs(step)) values.push(i);
    }
    return values;
  },
  edgeId: (from, to) => `${from}->${to}`,
  clone: (value) => JSON.parse(JSON.stringify(value)),
  step: (data) => ({
    title: data?.title || 'Step',
    explanation: data?.explanation || '',
    activeNodes: asArray(data?.activeNodes),
    activeEdges: asArray(data?.activeEdges),
    stateValues: isPlainObject(data?.stateValues) ? data.stateValues : {},
    highlightCells: asArray(data?.highlightCells),
    timelineIndex: typeof data?.timelineIndex === 'number' ? data.timelineIndex : undefined,
  }),
});

const normalizeGeneratedSimulation = (baseSimulation, generated) => {
  if (!isPlainObject(generated)) return baseSimulation;
  return {
    ...baseSimulation,
    ...generated,
    nodes: asArray(generated.nodes),
    edges: asArray(generated.edges),
    steps: asArray(generated.steps),
    timeline: asArray(generated.timeline),
    table: asArray(generated.table),
    sandbox: baseSimulation.sandbox,
  };
};

const executeSandboxProgram = (simulation, runKey) => {
  const sandbox = simulation.sandbox || {};

  if (!sandbox.enabled) {
    return {
      simulation,
      scriptError: '',
      inputError: '',
      isProgrammed: false,
    };
  }

  const script = (sandbox.code || '').trim();
  if (!script) {
    return {
      simulation,
      scriptError: 'Sandbox is enabled, but script code is empty.',
      inputError: '',
      isProgrammed: false,
    };
  }

  const parsedInput = parseMaybeJson(
    typeof sandbox.inputJson === 'string' ? sandbox.inputJson : sandbox.inputJson || sandbox.input || '{}'
  );

  if (parsedInput.error) {
    return {
      simulation,
      scriptError: '',
      inputError: `Sandbox input JSON is invalid: ${parsedInput.error}`,
      isProgrammed: false,
    };
  }

  try {
    const evaluator = new Function(
      'context',
      `
        "use strict";
        const window = undefined;
        const document = undefined;
        const globalThis = undefined;
        const fetch = undefined;
        const XMLHttpRequest = undefined;
        const WebSocket = undefined;
        const localStorage = undefined;
        const sessionStorage = undefined;
        const process = undefined;
        const require = undefined;
        const Function = undefined;
        ${script}
      `
    );

    const context = Object.freeze({
      input: parsedInput.value,
      helpers: buildSandboxHelpers(),
      meta: Object.freeze({
        title: simulation.title,
        diagramType: simulation.diagramType,
        runKey,
      }),
    });

    const generated = evaluator(context);
    const merged = normalizeGeneratedSimulation(simulation, generated);

    if (!isPlainObject(generated)) {
      return {
        simulation,
        scriptError: 'Sandbox code must return a simulation object.',
        inputError: '',
        isProgrammed: false,
      };
    }

    return {
      simulation: merged,
      scriptError: '',
      inputError: '',
      isProgrammed: true,
    };
  } catch (error) {
    return {
      simulation,
      scriptError: `Sandbox runtime error: ${error.message}`,
      inputError: '',
      isProgrammed: false,
    };
  }
};

function GraphListCanvas({ simulation, activeStep, compact }) {
  const nodes = asArray(simulation.nodes);
  const edges = asArray(simulation.edges);

  const activeNodeIds = new Set(asArray(activeStep?.activeNodes));
  const activeEdgeIds = new Set(asArray(activeStep?.activeEdges));
  const shouldDim = activeNodeIds.size > 0;

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-3`}>
        {nodes.map((node) => {
          const isActive = activeNodeIds.has(node.id);
          const isDimmed = shouldDim && !isActive;
          return (
            <div
              key={node.id}
              className={`rounded-xl border px-3 py-2 transition-all duration-300 ${
                isActive
                  ? 'border-primary bg-primary/10 shadow-sm scale-[1.01]'
                  : isDimmed
                    ? 'border-outline-variant/20 bg-surface-container-low opacity-45'
                    : 'border-outline-variant/30 bg-surface-container-lowest'
              }`}
            >
              <p className="text-xs font-bold text-outline uppercase tracking-widest">{node.id}</p>
              <p className="text-sm font-semibold text-on-surface mt-1">{node.label || node.id}</p>
            </div>
          );
        })}
      </div>

      {edges.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Transitions</p>
          {edges.map((edge) => {
            const currentEdgeId = edgeId(edge);
            const reverseEdgeId = `${edge.to}->${edge.from}`;
            const isActive = activeEdgeIds.has(currentEdgeId) || activeEdgeIds.has(reverseEdgeId);
            const isDimmed = activeEdgeIds.size > 0 && !isActive;
            return (
              <div
                key={currentEdgeId}
                className={`rounded-lg px-3 py-2 border text-xs transition-all duration-300 ${
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                    : isDimmed
                      ? 'border-outline-variant/20 bg-surface-container-low opacity-40'
                      : 'border-outline-variant/30 bg-surface-container-lowest text-outline'
                }`}
              >
                {edge.from} {'->'} {edge.to}
                {edge.label ? <span className="ml-2">({edge.label})</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GraphSvgCanvas({ simulation, activeStep }) {
  const nodes = asArray(simulation.nodes);
  const edges = asArray(simulation.edges);
  const canvas = isPlainObject(simulation.canvas) ? simulation.canvas : {};

  const width = Number(canvas.width) > 0 ? Number(canvas.width) : 560;
  const height = Number(canvas.height) > 0 ? Number(canvas.height) : 400;
  const padding = Number(canvas.padding) > 0 ? Number(canvas.padding) : 34;
  const nodeRadius = Number(canvas.nodeRadius) > 0 ? Number(canvas.nodeRadius) : 18;

  const activeNodeIds = new Set(asArray(activeStep?.activeNodes).map(String));
  const activeEdgeIds = new Set(asArray(activeStep?.activeEdges).map(String));

  const visitedFromState = asArray(activeStep?.stateValues?.visited).map(String);
  const outFromState = asArray(activeStep?.stateValues?.out).map(String);
  const visitedSet = new Set([...visitedFromState, ...outFromState]);

  const distances = isPlainObject(activeStep?.stateValues?.distances)
    ? activeStep.stateValues.distances
    : {};

  const nodeStyles = isPlainObject(activeStep?.nodeStyles) ? activeStep.nodeStyles : {};
  const edgeStyles = isPlainObject(activeStep?.edgeStyles) ? activeStep.edgeStyles : {};

  const toPixel = (value, axisSize) => {
    if (typeof value !== 'number') return null;
    if (value >= 0 && value <= 1) {
      return padding + value * (axisSize - padding * 2);
    }
    return value;
  };

  const points = new Map();
  nodes.forEach((node) => {
    const x = toPixel(node.x, width);
    const y = toPixel(node.y, height);
    if (typeof x === 'number' && typeof y === 'number') {
      points.set(String(node.id), { x, y, node });
    }
  });

  const toDisplayDistance = (value) => {
    if (value === undefined || value === null) return '';
    if (value === Infinity || value === 'Infinity') return '∞';
    return String(value);
  };

  return (
    <div className="rounded-xl bg-black p-3 sm:p-4 overflow-x-auto border border-white/10">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-white rounded-lg shadow-inner"
        role="img"
        aria-label="Interactive graph simulation"
      >
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />

        {edges.map((edge) => {
          const from = points.get(String(edge.from));
          const to = points.get(String(edge.to));
          if (!from || !to) return null;

          const currentEdgeId = edgeId(edge);
          const reverseEdgeId = `${edge.to}->${edge.from}`;
          const isActive = activeEdgeIds.has(currentEdgeId) || activeEdgeIds.has(reverseEdgeId);

          const override = isPlainObject(edgeStyles[currentEdgeId])
            ? edgeStyles[currentEdgeId]
            : isPlainObject(edgeStyles[reverseEdgeId])
              ? edgeStyles[reverseEdgeId]
              : {};

          const stroke = override.color || (isActive ? '#2e7d32' : '#1f2937');
          const strokeWidth = Number(override.width) > 0 ? Number(override.width) : isActive ? 2.5 : 1.5;
          const opacity = override.opacity ?? (isActive ? 1 : 0.85);
          const isDashed = Boolean(override.dashed);

          const midX = (from.x + to.x) / 2 + (Number(edge.labelOffsetX) || 0);
          const midY = (from.y + to.y) / 2 + (Number(edge.labelOffsetY) || -8);

          return (
            <g key={currentEdgeId} className="transition-all duration-300">
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={isDashed ? '5 4' : undefined}
                opacity={opacity}
              />
              {edge.label ? (
                <text x={midX} y={midY} fontSize="16" fill="#111827" textAnchor="middle" fontWeight="500">
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {nodes.map((node) => {
          const point = points.get(String(node.id));
          if (!point) return null;

          const customStyle = isPlainObject(nodeStyles[String(node.id)]) ? nodeStyles[String(node.id)] : {};
          const isVisited = visitedSet.has(String(node.id));
          const isActive = activeNodeIds.has(String(node.id));

          let fill = customStyle.fill || node.fill || '#ffffff';
          let stroke = customStyle.stroke || node.stroke || '#1f2937';
          let textColor = customStyle.textColor || node.textColor || '#111827';

          if (!customStyle.fill && node.role === 'source') {
            fill = '#d6d3ff';
          }
          if (isVisited || isActive) {
            fill = customStyle.fill || '#ef2626';
            stroke = customStyle.stroke || '#1f2937';
            textColor = customStyle.textColor || '#ffffff';
          }

          const distanceValue =
            distances[node.id] ??
            distances[node.label] ??
            distances[String(node.id)] ??
            distances[String(node.label)];
          const displayDistance = toDisplayDistance(distanceValue);

          return (
            <g key={node.id} className="transition-all duration-300">
              {displayDistance !== '' ? (
                <text
                  x={point.x - nodeRadius}
                  y={point.y - nodeRadius - 10}
                  fontSize="22"
                  fill="#1e88e5"
                  fontWeight="700"
                >
                  {displayDistance}
                </text>
              ) : null}

              <circle
                cx={point.x}
                cy={point.y}
                r={nodeRadius}
                fill={fill}
                stroke={stroke}
                strokeWidth={isActive ? 2.7 : 1.6}
              />

              <text
                x={point.x}
                y={point.y + 6}
                textAnchor="middle"
                fontSize="22"
                fill={textColor}
                fontWeight="700"
              >
                {node.label || node.id}
              </text>

              {node.caption ? (
                <text
                  x={point.x - nodeRadius}
                  y={point.y + nodeRadius + 18}
                  fontSize="14"
                  fill="#111827"
                  fontWeight="600"
                >
                  {node.caption}
                </text>
              ) : null}

              {isVisited ? (
                <text
                  x={point.x - nodeRadius - 30}
                  y={point.y}
                  fontSize="30"
                  fill="#ef2626"
                  fontWeight="700"
                >
                  Out
                </text>
              ) : null}
            </g>
          );
        })}

        {activeStep?.annotation || activeStep?.stateValues?.message ? (
          <text
            x={width - 170}
            y={height - 24}
            fontSize="26"
            fill="#7c4a03"
            fontWeight="600"
          >
            {activeStep.annotation || activeStep.stateValues.message}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function GraphCanvas({ simulation, activeStep, compact }) {
  const nodes = asArray(simulation.nodes);
  const hasPositionedNodes =
    nodes.length > 1 && nodes.every((node) => typeof node.x === 'number' && typeof node.y === 'number');

  if (hasPositionedNodes) {
    return <GraphSvgCanvas simulation={simulation} activeStep={activeStep} />;
  }

  return <GraphListCanvas simulation={simulation} activeStep={activeStep} compact={compact} />;
}

function TimelineCanvas({ simulation, activeStep }) {
  const timelineItems = asArray(simulation.timeline).length
    ? asArray(simulation.timeline)
    : asArray(simulation.steps).map((step, index) => ({
        id: `step-${index + 1}`,
        label: step.title || `Step ${index + 1}`,
      }));
  const activeIndex = typeof activeStep?.timelineIndex === 'number' ? activeStep.timelineIndex : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {timelineItems.map((item, index) => {
          const isActive = index === activeIndex;
          const isPassed = index < activeIndex;
          return (
            <div key={item.id || index} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-white scale-110'
                    : isPassed
                      ? 'bg-secondary text-white'
                      : 'bg-surface-container-high text-outline'
                }`}
              >
                {index + 1}
              </div>
              <p className={`text-sm ${isActive ? 'font-bold text-on-surface' : 'text-outline'}`}>
                {item.label || `Step ${index + 1}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableCanvas({ simulation, activeStep }) {
  const table = asArray(simulation.table);
  const highlighted = new Set(asArray(activeStep?.highlightCells).map((cell) => `${cell.row}-${cell.col}`));

  if (table.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/20 p-4 text-sm text-outline bg-surface-container-low">
        Add table rows in simulation data to render DP/state tables.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <tbody>
          {table.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {asArray(row).map((cell, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;
                const isHighlighted = highlighted.has(key);
                return (
                  <td
                    key={key}
                    className={`border px-3 py-2 text-sm transition-all duration-300 ${
                      isHighlighted
                        ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                        : 'border-outline-variant/30 bg-surface-container-lowest text-on-surface'
                    }`}
                  >
                    {renderStateValue(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InteractiveSimulationBlock({ block, compact = false }) {
  const baseSimulation = useMemo(() => safeParseSimulation(block?.content), [block?.content]);
  const [runKey, setRunKey] = useState(0);

  const runtime = useMemo(
    () => executeSandboxProgram(baseSimulation, runKey),
    [baseSimulation, runKey]
  );

  const simulation = runtime.simulation;
  const steps = asArray(simulation.steps);
  const diagramType = simulation.diagramType || 'FLOWCHART';

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSolution, setShowSolution] = useState(false);
  const [stepMode, setStepMode] = useState(true);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setCurrentStep(0);
    setIsPlaying(false);
    setShowSolution(false);
  }, [block?.id, block?.localId, block?.content, runKey]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (steps.length <= 1) return undefined;

    const intervalMs = Math.max(250, Math.round(1200 / speed));
    const timer = setInterval(() => {
      setCurrentStep((previous) => {
        if (previous >= steps.length - 1) {
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, steps.length]);

  const activeStep = steps[currentStep] || {};
  const totalSteps = Math.max(steps.length, 1);
  const isSandboxEnabled = Boolean(baseSimulation?.sandbox?.enabled);

  const goStepBack = () => {
    setShowSolution(false);
    setCurrentStep((previous) => Math.max(previous - 1, 0));
  };

  const goStepForward = () => {
    setShowSolution(false);
    setCurrentStep((previous) => Math.min(previous + 1, totalSteps - 1));
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setShowSolution(false);
    setCurrentStep(0);
  };

  const startAutoPlay = () => {
    if (stepMode) return;
    setShowSolution(false);
    setIsPlaying(true);
  };

  const toggleStepMode = () => {
    setStepMode((previous) => {
      const next = !previous;
      if (next) setIsPlaying(false);
      return next;
    });
  };

  const renderDiagram = () => {
    if (diagramType === 'TIMELINE') {
      return <TimelineCanvas simulation={simulation} activeStep={activeStep} />;
    }
    if (diagramType === 'DP_TABLE') {
      return <TableCanvas simulation={simulation} activeStep={activeStep} />;
    }
    if (GRAPH_LIKE_TYPES.has(diagramType)) {
      return <GraphCanvas simulation={simulation} activeStep={activeStep} compact={compact} />;
    }
    return <GraphCanvas simulation={simulation} activeStep={activeStep} compact={compact} />;
  };

  return (
    <article className={`rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 md:p-6 shadow-sm ${compact ? '' : 'space-y-5'}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">experiment</span>
            Interactive Simulation
          </p>
          <h3 className="text-xl font-bold text-on-surface mt-1">{simulation.title || 'Simulation Block'}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {DIAGRAM_LABELS[diagramType] || diagramType}
            </p>
            {isSandboxEnabled && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${runtime.isProgrammed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                Sandbox
              </span>
            )}
          </div>
        </div>
        <div className="text-xs font-semibold text-outline bg-surface-container-low px-3 py-1 rounded-full">
          Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
        </div>
      </header>

      {runtime.inputError && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {runtime.inputError}
        </div>
      )}

      {runtime.scriptError && (
        <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-surface">
          {runtime.scriptError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={goStepBack} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          Step Back
        </button>
        <button type="button" onClick={goStepForward} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          Step Forward
        </button>
        <button
          type="button"
          onClick={startAutoPlay}
          disabled={stepMode}
          className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors disabled:opacity-40"
        >
          Auto Play
        </button>
        <button type="button" onClick={() => setIsPlaying(false)} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          Pause
        </button>
        <button type="button" onClick={resetSimulation} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          Reset
        </button>
        {isSandboxEnabled && (
          <button type="button" onClick={() => setRunKey((previous) => previous + 1)} className="px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-xs font-bold text-primary hover:bg-primary/15 transition-colors">
            Run Program
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowSolution((previous) => !previous)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            showSolution
              ? 'border-secondary/40 bg-secondary/10 text-secondary'
              : 'border-outline-variant/30 hover:bg-surface-container-low'
          }`}
        >
          {showSolution ? 'Hide Solution' : 'Show Solution'}
        </button>
        <button
          type="button"
          onClick={toggleStepMode}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            stepMode
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-outline-variant/30 hover:bg-surface-container-low'
          }`}
        >
          {stepMode ? 'Step Mode On' : 'Step Mode Off'}
        </button>
        <button
          type="button"
          onClick={() => setShowHint((previous) => !previous)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            showHint
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
              : 'border-outline-variant/30 hover:bg-surface-container-low'
          }`}
        >
          {showHint ? 'Hide Hint' : 'Hint'}
        </button>
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface p-4 transition-all duration-300">
        {renderDiagram()}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-outline">Speed</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.25"
          value={speed}
          onChange={(event) => setSpeed(parseFloat(event.target.value))}
          className="w-36 accent-primary"
        />
        <span className="text-xs font-semibold text-outline">{speed.toFixed(2)}x</span>
      </div>

      {(simulation.description || activeStep.explanation || showSolution || showHint) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Explanation Panel</p>
            <p className="text-sm text-on-surface mt-2 leading-relaxed">
              {showSolution
                ? simulation.solutionText || 'Solution view enabled. Inspect final state values.'
                : activeStep.explanation || simulation.description || 'Step through the simulation to see details.'}
            </p>
            {activeStep.title ? (
              <p className="mt-2 text-xs font-semibold text-primary">Current: {activeStep.title}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Live State Values</p>
            <div className="mt-2 space-y-1">
              {Object.entries(activeStep.stateValues || {}).length === 0 ? (
                <p className="text-sm text-outline italic">No live values on this step.</p>
              ) : (
                Object.entries(activeStep.stateValues || {}).map(([key, value]) => (
                  <p key={key} className="text-sm text-on-surface">
                    <span className="font-bold">{key}:</span> {renderStateValue(value)}
                  </p>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {showHint && simulation.hint && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Hint:</p>
          <p className="mt-1">{simulation.hint}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Step Trail</p>
          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => (
              <button
                key={`${step.title || 'step'}-${index}`}
                type="button"
                onClick={() => {
                  setShowSolution(false);
                  setCurrentStep(index);
                }}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all duration-300 ${
                  index === currentStep
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-outline-variant/30 text-outline hover:bg-surface-container-low'
                }`}
              >
                {index + 1}. {step.title || `Step ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
