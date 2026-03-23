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

const fallbackSimulation = {
  title: 'Interactive Simulation',
  diagramType: 'FLOWCHART',
  description: 'Follow each step to understand how the process evolves.',
  hint: 'Use step mode to walk each transition carefully.',
  nodes: [
    { id: 'start', label: 'Start' },
    { id: 'compute', label: 'Compute' },
    { id: 'finish', label: 'Finish' },
  ],
  edges: [
    { from: 'start', to: 'compute', label: 'Next' },
    { from: 'compute', to: 'finish', label: 'Done' },
  ],
  steps: [
    {
      title: 'Initialize',
      explanation: 'We begin at the start node and initialize state.',
      activeNodes: ['start'],
      activeEdges: [],
      stateValues: { phase: 'init', value: 0 },
    },
    {
      title: 'Process',
      explanation: 'Move into the computation stage and update state.',
      activeNodes: ['compute'],
      activeEdges: ['start->compute'],
      stateValues: { phase: 'compute', value: 42 },
    },
    {
      title: 'Complete',
      explanation: 'Finish the process and return final state.',
      activeNodes: ['finish'],
      activeEdges: ['compute->finish'],
      stateValues: { phase: 'done', value: 42 },
    },
  ],
  solutionText: 'The process converges after all transitions are complete.',
};

const safeParseSimulation = (content) => {
  if (!content) return fallbackSimulation;
  if (typeof content === 'object') return { ...fallbackSimulation, ...content };
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return { ...fallbackSimulation, ...parsed };
    } catch (error) {
      return fallbackSimulation;
    }
  }
  return fallbackSimulation;
};

const toEdgeId = (edge) => edge.id || `${edge.from}->${edge.to}`;

const renderStateValue = (value) => {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

function GraphCanvas({ simulation, activeStep, compact }) {
  const nodes = simulation.nodes || [];
  const edges = simulation.edges || [];

  const activeNodeIds = new Set(activeStep?.activeNodes || []);
  const activeEdgeIds = new Set(activeStep?.activeEdges || []);
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
              <p className="text-sm font-semibold text-on-surface mt-1">{node.label}</p>
            </div>
          );
        })}
      </div>

      {edges.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Transitions</p>
          {edges.map((edge) => {
            const edgeId = toEdgeId(edge);
            const isActive = activeEdgeIds.has(edgeId) || activeEdgeIds.has(`${edge.from}->${edge.to}`);
            const isDimmed = activeEdgeIds.size > 0 && !isActive;
            return (
              <div
                key={edgeId}
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

function TimelineCanvas({ simulation, activeStep }) {
  const timelineItems = simulation.timeline || (simulation.steps || []).map((step, idx) => ({
    id: `step-${idx + 1}`,
    label: step.title || `Step ${idx + 1}`,
  }));
  const activeIndex = activeStep?.timelineIndex ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {timelineItems.map((item, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = idx < activeIndex;
          return (
            <div key={item.id || idx} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-white scale-110'
                    : isPassed
                      ? 'bg-secondary text-white'
                      : 'bg-surface-container-high text-outline'
                }`}
              >
                {idx + 1}
              </div>
              <p className={`text-sm ${isActive ? 'font-bold text-on-surface' : 'text-outline'}`}>{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableCanvas({ simulation, activeStep }) {
  const table = simulation.table || [];
  const highlighted = new Set((activeStep?.highlightCells || []).map((c) => `${c.row}-${c.col}`));

  if (!Array.isArray(table) || table.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/20 p-4 text-sm text-outline bg-surface-container-low">
        Add `table` rows in simulation data to render DP/state tables.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <tbody>
          {table.map((row, rowIdx) => (
            <tr key={`row-${rowIdx}`}>
              {row.map((cell, colIdx) => {
                const key = `${rowIdx}-${colIdx}`;
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
  const simulation = useMemo(() => safeParseSimulation(block?.content), [block?.content]);
  const steps = simulation.steps || [];
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
  }, [block?.id, block?.localId, block?.content]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (steps.length <= 1) return undefined;

    const intervalMs = Math.max(250, Math.round(1200 / speed));
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, steps.length]);

  const activeStep = steps[currentStep] || {};
  const totalSteps = Math.max(steps.length, 1);

  const goStepBack = () => {
    setShowSolution(false);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goStepForward = () => {
    setShowSolution(false);
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setShowSolution(false);
    setCurrentStep(0);
  };

  const toggleAutoPlay = () => {
    if (stepMode) return;
    setShowSolution(false);
    setIsPlaying(true);
  };

  const toggleStepMode = () => {
    setStepMode((prev) => {
      const next = !prev;
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
          <p className="text-[11px] font-semibold text-outline mt-1 uppercase tracking-wider">
            {DIAGRAM_LABELS[diagramType] || diagramType}
          </p>
        </div>
        <div className="text-xs font-semibold text-outline bg-surface-container-low px-3 py-1 rounded-full">
          Step {Math.min(currentStep + 1, totalSteps)} / {totalSteps}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={goStepBack} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          ◀ Step Back
        </button>
        <button type="button" onClick={goStepForward} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          ▶ Step Forward
        </button>
        <button
          type="button"
          onClick={toggleAutoPlay}
          disabled={stepMode}
          className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors disabled:opacity-40"
        >
          ⏭ Auto Play
        </button>
        <button type="button" onClick={() => setIsPlaying(false)} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          ⏸ Pause
        </button>
        <button type="button" onClick={resetSimulation} className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container-low transition-colors">
          🔁 Reset
        </button>
        <button
          type="button"
          onClick={() => setShowSolution((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            showSolution
              ? 'border-secondary/40 bg-secondary/10 text-secondary'
              : 'border-outline-variant/30 hover:bg-surface-container-low'
          }`}
        >
          🎯 {showSolution ? 'Hide Solution' : 'Show Solution'}
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
          👣 {stepMode ? 'Step-by-step On' : 'Step-by-step Off'}
        </button>
        <button
          type="button"
          onClick={() => setShowHint((prev) => !prev)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            showHint
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
              : 'border-outline-variant/30 hover:bg-surface-container-low'
          }`}
        >
          🧠 {showHint ? 'Hide Hint' : 'Hint'}
        </button>
      </div>

      <div className="rounded-xl border border-outline-variant/20 bg-surface p-4 transition-all duration-300">
        {renderDiagram()}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-outline">🎛 Speed</label>
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
            {steps.map((step, idx) => (
              <button
                key={`${step.title || 'step'}-${idx}`}
                type="button"
                onClick={() => {
                  setShowSolution(false);
                  setCurrentStep(idx);
                }}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all duration-300 ${
                  idx === currentStep
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-outline-variant/30 text-outline hover:bg-surface-container-low'
                }`}
              >
                {idx + 1}. {step.title || `Step ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
