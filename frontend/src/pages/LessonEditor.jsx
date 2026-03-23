import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lessonService } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import InteractiveSimulationBlock from '../components/InteractiveSimulationBlock';

// Simple ID generator for local new blocks
const generateId = () => Math.random().toString(36).substr(2, 9);

const SIMULATION_TYPES = [
  'FLOWCHART',
  'GRAPH',
  'TREE',
  'STATE_MACHINE',
  'STEP_PROCESS',
  'ALGORITHM',
  'TIMELINE',
  'DECISION_DIAGRAM',
  'DP_TABLE',
  'RECURSION_TREE',
  'SYSTEM_ARCHITECTURE',
];

const DEFAULT_SIMULATION_SANDBOX_CODE = `const { input, helpers } = context;

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

const distances = {};
const previous = {};
const visited = new Set();
nodes.forEach((node) => {
  distances[node.id] = Infinity;
  previous[node.id] = null;
});
distances[start] = 0;

const steps = [];
steps.push({
  title: 'Initialize Distances',
  explanation: 'Set all node distances to Infinity except the source node.',
  activeNodes: [start],
  activeEdges: [],
  stateValues: {
    start,
    target,
    distances: { ...distances },
    visited: [],
  },
});

while (visited.size < nodes.length) {
  let current = null;
  let bestDistance = Infinity;

  nodes.forEach((node) => {
    if (!visited.has(node.id) && distances[node.id] < bestDistance) {
      bestDistance = distances[node.id];
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
      distances: { ...distances },
      visited: [...visited],
    },
  });

  const neighbors = adjacency.get(current) || [];
  neighbors.forEach((edge) => {
    const nextDistance = distances[current] + edge.weight;
    if (nextDistance < (distances[edge.to] ?? Infinity)) {
      distances[edge.to] = nextDistance;
      previous[edge.to] = current;

      steps.push({
        title: 'Relax ' + edge.from + ' -> ' + edge.to,
        explanation: 'Update shortest-known distance to node ' + edge.to + '.',
        activeNodes: [edge.from, edge.to],
        activeEdges: [helpers.edgeId(edge.from, edge.to)],
        stateValues: {
          current,
          updatedNode: edge.to,
          distances: { ...distances },
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
  cursor = previous[cursor];
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
      totalCost: distances[target],
      visited: [...visited],
      distances: { ...distances },
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
      ? 'Shortest path to ' + target + ': ' + path.join(' -> ') + ' (cost ' + distances[target] + ')'
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

const defaultSimulationContent = () => ({
  title: 'Interactive Simulation Sandbox',
  diagramType: 'GRAPH',
  description: 'Programmable simulation environment. AI can generate code to create dynamic steps and visuals.',
  hint: 'Use Step controls to inspect each transition.',
  sandbox: {
    enabled: true,
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
    code: DEFAULT_SIMULATION_SANDBOX_CODE,
  },
  nodes: [
    { id: 'start', label: 'Start' },
    { id: 'process', label: 'Process' },
    { id: 'finish', label: 'Finish' },
  ],
  edges: [
    { from: 'start', to: 'process', label: 'next' },
    { from: 'process', to: 'finish', label: 'done' },
  ],
  table: [],
  steps: [
    {
      title: 'Sandbox Ready',
      explanation: 'Run the script to generate dynamic simulation steps.',
      activeNodes: ['start'],
      activeEdges: [],
      stateValues: { status: 'ready' },
    },
  ],
  solutionText: 'Use sandbox code to compute and explain the final state.',
});

const nodesToText = (nodes = []) =>
  nodes.map((node) => `${node.id || ''}|${node.label || ''}`).join('\n');

const edgesToText = (edges = []) =>
  edges.map((edge) => `${edge.from || ''}->${edge.to || ''}|${edge.label || ''}`).join('\n');

const parseNodesText = (text = '') =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = '', label = ''] = line.split('|');
      return { id: id.trim(), label: label.trim() || id.trim() };
    })
    .filter((node) => node.id);

const parseEdgesText = (text = '') =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [path = '', label = ''] = line.split('|');
      const [from = '', to = ''] = path.split('->');
      return { from: from.trim(), to: to.trim(), label: label.trim() };
    })
    .filter((edge) => edge.from && edge.to);

const stateValuesToText = (values = {}) =>
  Object.entries(values)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n');

const parseStateValuesText = (text = '') => {
  const result = {};
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [rawKey, ...rawValue] = line.split('=');
      const key = (rawKey || '').trim();
      if (!key) return;
      const valueText = rawValue.join('=').trim();
      if (valueText === '') {
        result[key] = '';
        return;
      }
      if (!Number.isNaN(Number(valueText)) && valueText !== '') {
        result[key] = Number(valueText);
        return;
      }
      if (valueText === 'true' || valueText === 'false') {
        result[key] = valueText === 'true';
        return;
      }
      try {
        result[key] = JSON.parse(valueText);
      } catch {
        result[key] = valueText;
      }
    });
  return result;
};

export default function LessonEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const searchParams = new URLSearchParams(location.search);
  const lessonId = searchParams.get('lessonId');

  const [lesson, setLesson] = useState(null);
  const [title, setTitle] = useState('Untitled Lesson');
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AI Assistant menu toggle
  const [showAiMenu, setShowAiMenu] = useState(false);
  
  // Code execution state
  const [codeOutputs, setCodeOutputs] = useState({});

  const handleRunCode = (localId, code) => {
    try {
      let output = '';
      const originalLog = console.log;
      console.log = (...args) => {
        output += args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
      };
      // eslint-disable-next-line no-eval
      eval(code);
      console.log = originalLog;
      setCodeOutputs(prev => ({ ...prev, [localId]: output || 'Done (no output)' }));
    } catch (err) {
      setCodeOutputs(prev => ({ ...prev, [localId]: `Error: ${err.message}` }));
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!lessonId) {
      navigate('/dashboard');
      return;
    }
    fetchLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, user, navigate]);

  const fetchLesson = async () => {
    try {
      setLoading(true);
      const data = await lessonService.getById(lessonId);
      setLesson(data);
      setTitle(data.title);
      
      if (data.blocks && data.blocks.length > 0) {
        setBlocks(data.blocks.map(b => {
          let parsedContent = b.content;
          if (
            (b.type === 'QUIZ' ||
              b.type === 'EXERCISE' ||
              b.type === 'WRITTEN_QUIZ' ||
              b.type === 'INTERACTIVE_SIMULATION') &&
            typeof b.content === 'string'
          ) {
            try { parsedContent = JSON.parse(b.content); } catch (e) { console.error(e); }
          }
          return { ...b, localId: b.id, content: parsedContent };
        }));
      } else {
        // Init with one empty text block
        setBlocks([{ localId: generateId(), type: 'TEXT', content: '' }]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status = lesson?.status) => {
    setSaving(true);
    setError('');
    try {
      const sanitizedBlocks = blocks.map((b) => ({
        type: b.type,
        content:
          (b.type === 'QUIZ' ||
            b.type === 'EXERCISE' ||
            b.type === 'WRITTEN_QUIZ' ||
            b.type === 'INTERACTIVE_SIMULATION') &&
          typeof b.content !== 'string'
            ? b.content
            : b.content,
      }));
      
      const updatedLesson = await lessonService.update(lessonId, {
        title,
        status,
        blocks: sanitizedBlocks
      });
      
      setLesson(updatedLesson);
      // alert('Saved successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lesson');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = (localId, newContent) => {
    setBlocks(blocks.map(b => b.localId === localId ? { ...b, content: newContent } : b));
  };

  const addBlock = (type) => {
    const newBlock = { 
      localId: generateId(), 
      type, 
      content: (type === 'QUIZ' || type === 'EXERCISE') ? { question: '', options: [{text: '', isCorrect: true, feedback: ''}, {text: '', isCorrect: false, feedback: ''}], timeLimit: 30 } : 
               (type === 'WRITTEN_QUIZ') ? { question: '', idealAnswer: '' } :
               (type === 'INTERACTIVE_SIMULATION') ? defaultSimulationContent() : '' 
    };
    setBlocks([...blocks, newBlock]);
    setShowAiMenu(false);
  };

  const deleteBlock = (localId) => {
    setBlocks(blocks.filter(b => b.localId !== localId));
  };

  const moveBlock = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === blocks.length - 1) return;
    
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  // UI rendering helpers for blocks
  const renderBlock = (block, index) => {
    if (block.type === 'TEXT') {
      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-outline tracking-widest uppercase">
            <span className="material-symbols-outlined text-sm">subject</span> Explanation
          </div>
          <textarea 
            className="w-full text-lg leading-relaxed text-on-surface bg-transparent resize-y outline-none border-b border-transparent focus:border-primary/30 transition-colors"
            placeholder="Type explanation here..."
            rows={4}
            value={block.content}
            onChange={(e) => updateBlock(block.localId, e.target.value)}
          />
        </section>
      );
    }
    
    if (block.type === 'CODE') {
      return (
        <section key={block.localId} className="group relative bg-[#1c1f21] text-secondary-fixed rounded-xl p-8 font-mono text-sm transition-all hover:shadow-xl notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} dark />
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-outline-variant text-xs font-bold tracking-widest uppercase">
              <span className="material-symbols-outlined text-sm">code</span> Code Snippet
            </div>
            <button onClick={() => handleRunCode(block.localId, block.content)} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors" type="button"><span className="material-symbols-outlined text-sm">play_arrow</span> RUN</button>
          </div>
          <textarea
            className="w-full text-primary-fixed bg-transparent resize-y outline-none font-mono"
            placeholder="# Write python code here..."
            rows={6}
            value={block.content}
            onChange={(e) => updateBlock(block.localId, e.target.value)}
            spellCheck={false}
          />
          {codeOutputs[block.localId] && (
            <div className="mt-4 p-4 bg-black/40 rounded-lg border border-white/5 font-mono text-xs text-secondary-fixed-dim">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] font-bold text-outline-variant uppercase">Output:</div>
                <button onClick={() => setCodeOutputs(prev => ({ ...prev, [block.localId]: null }))} className="text-[10px] uppercase text-error hover:text-error/80">Clear</button>
              </div>
              <pre className="whitespace-pre-wrap">{codeOutputs[block.localId]}</pre>
            </div>
          )}
        </section>
      );
    }
    
    if (block.type === 'DISCUSSION') {
      return (
        <section key={block.localId} className="group relative bg-primary-fixed rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-4 text-xs font-bold text-on-primary-fixed-variant tracking-widest uppercase">
            <span className="material-symbols-outlined text-sm">forum</span> Discussion Prompt
          </div>
          <textarea
            className="w-full text-xl font-medium text-on-primary-fixed bg-transparent resize-y outline-none"
            placeholder="What should students discuss?"
            rows={3}
            value={block.content}
            onChange={(e) => updateBlock(block.localId, e.target.value)}
          />
        </section>
      );
    }
    
    if (block.type === 'QUIZ' || block.type === 'EXERCISE') {
      const qData = typeof block.content === 'object' ? block.content : { question: '', options: [], timeLimit: 30 };
      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className={`flex items-center gap-2 mb-6 text-xs font-bold tracking-widest uppercase ${block.type === 'EXERCISE' ? 'text-primary' : 'text-secondary'}`}>
            <span className="material-symbols-outlined text-sm">{block.type === 'EXERCISE' ? 'menu_book' : 'quiz'}</span> {block.type === 'EXERCISE' ? 'Check for Understanding' : 'Quick Quiz'}
          </div>
          {block.type === 'QUIZ' && (
            <div className="mb-6 flex items-center gap-4">
              <label className="text-sm font-semibold text-outline-variant">Time Limit (seconds):</label>
              <input 
                type="number" 
                min="10"
                className="w-24 bg-surface-container-low border border-outline-variant rounded-md px-3 py-1 text-on-surface outline-none focus:border-primary" 
                value={qData.timeLimit === undefined ? 30 : qData.timeLimit}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    updateBlock(block.localId, { ...qData, timeLimit: 0 });
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      updateBlock(block.localId, { ...qData, timeLimit: parsed });
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 10) {
                    updateBlock(block.localId, { ...qData, timeLimit: 10 });
                  }
                }}
              />
            </div>
          )}
          <input 
            type="text" 
            className="w-full text-xl font-semibold mb-6 bg-transparent outline-none border-b border-outline-variant focus:border-primary pb-2" 
            placeholder="Question goes here..."
            value={qData.question || ''}
            onChange={(e) => updateBlock(block.localId, { ...qData, question: e.target.value })}
          />
          <div className="space-y-3">
            {(qData.options || []).map((opt, optIndex) => (
              <div key={optIndex} className={`flex items-center p-4 rounded-lg bg-surface-container-low border transition-all ${opt.isCorrect ? 'border-primary bg-primary/5' : 'border-transparent'}`}>
                <button 
                  onClick={() => {
                    const newOpts = [...qData.options];
                    newOpts.forEach(o => o.isCorrect = false);
                    newOpts[optIndex].isCorrect = true;
                    updateBlock(block.localId, { ...qData, options: newOpts });
                  }}
                  className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 ${opt.isCorrect ? 'border-primary' : 'border-outline hover:border-primary'}`}
                >
                  {opt.isCorrect && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                </button>
                <input 
                  type="text" 
                  className={`w-full bg-transparent outline-none font-medium ${opt.isCorrect ? 'text-primary' : 'text-on-surface'}`}
                  placeholder={`Option ${optIndex + 1}`}
                  value={opt.text}
                  onChange={(e) => {
                    const newOpts = [...qData.options];
                    newOpts[optIndex].text = e.target.value;
                    updateBlock(block.localId, { ...qData, options: newOpts });
                  }}
                />
                {block.type === 'EXERCISE' && (
                  <input 
                    type="text" 
                    className="w-full bg-transparent outline-none font-medium ml-4 text-xs text-outline-variant italic border-l pl-4"
                    placeholder={`Feedback ${optIndex + 1}`}
                    value={opt.feedback || ''}
                    onChange={(e) => {
                      const newOpts = [...qData.options];
                      newOpts[optIndex].feedback = e.target.value;
                      updateBlock(block.localId, { ...qData, options: newOpts });
                    }}
                  />
                )}
                <button onClick={() => {
                   const newOpts = qData.options.filter((_, i) => i !== optIndex);
                   updateBlock(block.localId, { ...qData, options: newOpts });
                }} className="text-outline hover:text-error ml-2" type="button">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            ))}
            <button 
              onClick={() => {
                updateBlock(block.localId, { ...qData, options: [...(qData.options || []), { text: '', isCorrect: false, feedback: '' }] });
              }}
              className="mt-4 text-sm font-semibold text-primary hover:bg-primary/5 px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span> Add Option
            </button>
          </div>
        </section>
      );
    }
    if (block.type === 'WRITTEN_QUIZ') {
      const qData = typeof block.content === 'object' ? block.content : { question: '', idealAnswer: '' };
      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-6 text-xs font-bold tracking-widest uppercase text-amber-600">
            <span className="material-symbols-outlined text-sm">edit_document</span> Written Exercise
          </div>
          <input 
            type="text" 
            className="w-full text-xl font-semibold mb-6 bg-transparent outline-none border-b border-outline-variant focus:border-primary pb-2" 
            placeholder="Question goes here..."
            value={qData.question || ''}
            onChange={(e) => updateBlock(block.localId, { ...qData, question: e.target.value })}
          />
          <textarea
            className="w-full text-base leading-relaxed text-on-surface bg-surface-container-low rounded-lg p-4 resize-y outline-none border border-outline-variant focus:border-primary transition-colors"
            placeholder="Write the ideal answer here. AI will use this to evaluate students' answers..."
            rows={4}
            value={qData.idealAnswer || ''}
            onChange={(e) => updateBlock(block.localId, { ...qData, idealAnswer: e.target.value })}
          />
        </section>
      );
    }

    if (block.type === 'INTERACTIVE_SIMULATION') {
      const simData = typeof block.content === 'object' ? block.content : defaultSimulationContent();
      const steps = simData.steps || [];
      const updateSimulation = (changes) => updateBlock(block.localId, { ...simData, ...changes });
      const updateSimulationStep = (stepIndex, changes) => {
        const nextSteps = [...steps];
        nextSteps[stepIndex] = { ...nextSteps[stepIndex], ...changes };
        updateSimulation({ steps: nextSteps });
      };
      const sandbox = simData.sandbox && typeof simData.sandbox === 'object' ? simData.sandbox : {};
      const sandboxEnabled = Boolean(sandbox.enabled);
      const updateSandbox = (changes) =>
        updateSimulation({
          sandbox: { ...sandbox, ...changes },
        });
      const loadDefaultSandboxTemplate = () =>
        updateSandbox({
          enabled: true,
          code: DEFAULT_SIMULATION_SANDBOX_CODE,
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
        });

      return (
        <section key={block.localId} className="group relative bg-surface-container-lowest rounded-xl p-8 transition-all hover:shadow-lg notebook-line border-l-2 border-transparent hover:border-l-primary mb-8">
          <BlockControls index={index} localId={block.localId} />
          <div className="flex items-center gap-2 mb-6 text-xs font-bold tracking-widest uppercase text-primary">
            <span className="material-symbols-outlined text-sm">experiment</span> Interactive Simulation
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Title</label>
              <input
                type="text"
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                value={simData.title || ''}
                onChange={(e) => updateSimulation({ title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Diagram Type</label>
              <select
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                value={simData.diagramType || 'FLOWCHART'}
                onChange={(e) => updateSimulation({ diagramType: e.target.value })}
              >
                {SIMULATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Description</label>
              <textarea
                rows={2}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-y"
                value={simData.description || ''}
                onChange={(e) => updateSimulation({ description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Hint</label>
              <input
                type="text"
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                value={simData.hint || ''}
                onChange={(e) => updateSimulation({ hint: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Solution Text</label>
              <textarea
                rows={2}
                className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-y"
                value={simData.solutionText || ''}
                onChange={(e) => updateSimulation({ solutionText: e.target.value })}
              />
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-outline-variant/25 bg-surface-container-low p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Programmable Sandbox</p>
                <p className="text-xs text-outline mt-1">
                  Let AI or teachers write JavaScript that returns the full simulation object.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface">
                <input
                  type="checkbox"
                  checked={sandboxEnabled}
                  onChange={(e) => updateSandbox({ enabled: e.target.checked })}
                  className="accent-primary"
                />
                Enable runtime
              </label>
            </div>

            {sandboxEnabled && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
                    Input JSON
                  </label>
                  <textarea
                    rows={6}
                    className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y"
                    placeholder='{"start":"A","target":"E","nodes":[],"edges":[]}'
                    value={typeof sandbox.inputJson === 'string' ? sandbox.inputJson : '{}'}
                    onChange={(e) => updateSandbox({ inputJson: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
                    Sandbox Script (must return a simulation object)
                  </label>
                  <textarea
                    rows={14}
                    className="w-full bg-[#1c1f21] text-slate-100 border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y"
                    value={typeof sandbox.code === 'string' ? sandbox.code : ''}
                    onChange={(e) => updateSandbox({ code: e.target.value })}
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadDefaultSandboxTemplate}
                    className="text-xs font-semibold text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg"
                  >
                    Load Dijkstra template
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSandbox({ code: '' })}
                    className="text-xs font-semibold text-error border border-error/30 bg-error/5 hover:bg-error/10 px-3 py-1.5 rounded-lg"
                  >
                    Clear script
                  </button>
                </div>
                <p className="text-[11px] text-outline">
                  Script entrypoint: use <code>context.input</code> and <code>context.helpers</code>, then{' '}
                  <code>return {'{ ... }'}</code> with fields like <code>nodes</code>, <code>edges</code>,{' '}
                  <code>steps</code>, <code>table</code>, <code>timeline</code>, <code>description</code>, and{' '}
                  <code>solutionText</code>.
                </p>
              </>
            )}
          </div>

          <details className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4" open={!sandboxEnabled}>
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-outline">
              Manual Step Authoring (Optional Fallback)
            </summary>
            <p className="text-xs text-outline mt-2 mb-4">
              Use this when you want static steps. If sandbox runtime is enabled, these fields act as a fallback.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Nodes (id|label per line)</label>
                <textarea
                  rows={5}
                  className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y"
                  value={nodesToText(simData.nodes)}
                  onChange={(e) => updateSimulation({ nodes: parseNodesText(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-2">Edges (from-&gt;to|label per line)</label>
                <textarea
                  rows={5}
                  className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y"
                  value={edgesToText(simData.edges)}
                  onChange={(e) => updateSimulation({ edges: parseEdgesText(e.target.value) })}
                />
              </div>
            </div>

          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Steps</p>
              <button
                type="button"
                onClick={() =>
                  updateSimulation({
                    steps: [
                      ...steps,
                      {
                        title: `Step ${steps.length + 1}`,
                        explanation: '',
                        activeNodes: [],
                        activeEdges: [],
                        stateValues: {},
                      },
                    ],
                  })
                }
                className="text-xs font-semibold text-primary hover:bg-primary/5 px-2 py-1 rounded-lg"
              >
                + Add Step
              </button>
            </div>

            {steps.map((step, stepIndex) => (
              <div key={`${block.localId}-step-${stepIndex}`} className="rounded-xl border border-outline-variant/25 p-3 bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-on-surface">Step {stepIndex + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      updateSimulation({
                        steps: steps.filter((_, idx) => idx !== stepIndex),
                      })
                    }
                    className="text-xs text-error hover:bg-error/10 px-2 py-1 rounded-lg"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Step title"
                  value={step.title || ''}
                  onChange={(e) => updateSimulationStep(stepIndex, { title: e.target.value })}
                />
                <textarea
                  rows={2}
                  className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-y"
                  placeholder="Step explanation"
                  value={step.explanation || ''}
                  onChange={(e) => updateSimulationStep(stepIndex, { explanation: e.target.value })}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                    placeholder="Active nodes (comma separated)"
                    value={(step.activeNodes || []).join(', ')}
                    onChange={(e) =>
                      updateSimulationStep(stepIndex, {
                        activeNodes: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                      })
                    }
                  />
                  <input
                    type="text"
                    className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
                    placeholder="Active edges (comma separated)"
                    value={(step.activeEdges || []).join(', ')}
                    onChange={(e) =>
                      updateSimulationStep(stepIndex, {
                        activeEdges: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
                <textarea
                  rows={3}
                  className="w-full bg-white border border-outline-variant/40 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-primary resize-y"
                  placeholder="State values (key=value per line)"
                  value={stateValuesToText(step.stateValues || {})}
                  onChange={(e) => updateSimulationStep(stepIndex, { stateValues: parseStateValuesText(e.target.value) })}
                />
              </div>
            ))}
          </div>
          </details>

          <div className="rounded-xl border border-outline-variant/20 p-4 bg-surface-container-low">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-3">Preview</p>
            <InteractiveSimulationBlock block={{ ...block, content: simData }} compact />
          </div>
        </section>
      );
    }
    
    return null;
  };

  const BlockControls = ({ index, localId, dark = false }) => (
    <div className={`absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity bg-surface p-1 rounded-full shadow-sm border border-outline-variant/30 ${dark ? 'bg-[#2c2c2c] border-white/10' : ''}`}>
      <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className={`p-1.5 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-30 ${dark ? 'text-white' : 'text-on-surface'}`}><span className="material-symbols-outlined text-[1rem]">arrow_upward</span></button>
      <button onClick={() => deleteBlock(localId)} className="p-1.5 rounded-full hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors"><span className="material-symbols-outlined text-[1rem]">delete</span></button>
      <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className={`p-1.5 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-30 ${dark ? 'text-white' : 'text-on-surface'}`}><span className="material-symbols-outlined text-[1rem]">arrow_downward</span></button>
    </div>
  );

  if (loading) {
    return <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center">Loading editor...</div>;
  }

  return (
    <div className="bg-surface text-on-surface overflow-hidden min-h-screen flex flex-col">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-[#f8f9fa]/80 dark:bg-[#191c1d]/80 backdrop-blur-xl shadow-sm border-b border-outline-variant/20 flex justify-between items-center px-8 h-16 w-full">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="text-xl font-bold text-[#191c1d] dark:text-white tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">school</span>
            Academic Atelier
          </Link>
          <div className="hidden md:flex gap-6 border-l border-outline-variant/30 pl-6 ml-2">
            <Link to={`/class/stream?classId=${lesson?.class_id}`} className="font-['Inter'] font-medium text-sm tracking-tight text-[#727785] hover:text-[#191c1d] transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Class
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block mr-2 text-sm text-outline font-medium">
            {saving ? 'Saving...' : 'All changes saved locally'}
          </div>
          <button 
            onClick={() => handleSave(lesson.status)} 
            disabled={saving}
            className="flex items-center gap-2 bg-surface text-primary border border-primary px-4 py-1.5 rounded-full font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            Save
          </button>
          <button 
            onClick={() => handleSave('PUBLISHED')}
            disabled={saving || lesson.status === 'PUBLISHED'}
            className="bg-secondary text-white px-5 py-1.5 rounded-full font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50"
          >
            {lesson.status === 'PUBLISHED' ? 'Published' : 'Publish'}
          </button>
          <Link 
            to={`/lesson/live?lessonId=${lessonId}`}
            className="flex items-center gap-1 bg-emerald-500 text-white px-5 py-1.5 rounded-full font-semibold shadow-md active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">present_to_all</span> Present
          </Link>
        </div>
      </nav>
      
      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* Main Content Area (Editor Canvas) */}
        <main className="flex-1 overflow-y-auto bg-surface-container-low px-4 md:px-12 py-12 scroll-smooth">
          <div className="max-w-3xl mx-auto min-h-full pb-32">
            {error && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}
            
            {/* Lesson Header */}
            <div className="mb-12">
              <span className="text-label-md uppercase tracking-[0.2em] text-primary font-bold mb-4 block">Interactive Notebook • {lesson?.class?.name || 'Class'}</span>
              <input 
                className="w-full text-[3rem] font-bold text-on-surface leading-tight tracking-tight mb-4 outline-none bg-transparent placeholder-outline-variant"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson Title"
              />
            </div>
            
            {/* Interactive Blocks Container */}
            <div className="space-y-4">
              {blocks.map((block, index) => renderBlock(block, index))}
            </div>
            
            {/* Inline Add Block Actions */}
            <div className="mt-8 pt-8 border-t border-dashed border-outline-variant/40 flex justify-center gap-2">
              <button onClick={() => addBlock('TEXT')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">subject</span> Text
              </button>
              <button onClick={() => addBlock('CODE')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">code</span> Code
              </button>
              <button onClick={() => addBlock('EXERCISE')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">menu_book</span> Exercise
              </button>
              <button onClick={() => addBlock('QUIZ')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">quiz</span> Quiz
              </button>
              <button onClick={() => addBlock('DISCUSSION')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">forum</span> Prompt
              </button>
              <button onClick={() => addBlock('WRITTEN_QUIZ')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">edit_document</span> Written
              </button>
              <button onClick={() => addBlock('INTERACTIVE_SIMULATION')} className="px-4 py-2 rounded-full border border-outline-variant/50 hover:bg-surface hover:text-primary hover:border-primary transition-all text-sm font-medium flex items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[1.2rem]">experiment</span> Simulation
              </button>
            </div>
          </div>
        </main>
      </div>
      
      {/* AI Assistant Floating Menu */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end z-[60]">
        {showAiMenu && (
          <div className="bg-surface shadow-2xl rounded-2xl p-4 w-64 border border-outline-variant/20 mb-4 animate-in slide-in-from-bottom-2">
            <p className="text-xs font-bold text-primary mb-2">ADD BLOCK</p>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => addBlock('TEXT')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">subject</span> Explanation</button>
              <button onClick={() => addBlock('CODE')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">code</span> Python Script</button>
              <button onClick={() => addBlock('EXERCISE')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">menu_book</span> Exercise MCQ</button>
              <button onClick={() => addBlock('QUIZ')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">quiz</span> Quick Quiz</button>
              <button onClick={() => addBlock('WRITTEN_QUIZ')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">edit_document</span> Written Quiz</button>
              <button onClick={() => addBlock('DISCUSSION')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">forum</span> Discussion Prompt</button>
              <button onClick={() => addBlock('INTERACTIVE_SIMULATION')} className="text-sm text-left px-3 py-2 rounded-lg bg-surface-container hover:bg-primary/10 transition-colors font-medium flex items-center gap-2"><span className="material-symbols-outlined text-sm">experiment</span> Interactive Simulation</button>
            </div>
          </div>
        )}
        <button 
          onClick={() => setShowAiMenu(!showAiMenu)}
          className="bg-gradient-to-br from-primary to-primary-container text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        >
          <span className="material-symbols-outlined text-2xl">{showAiMenu ? 'close' : 'add'}</span>
        </button>
      </div>
    </div>
  );
}
