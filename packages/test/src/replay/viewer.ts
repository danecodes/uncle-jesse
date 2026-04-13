import type { ReplayTimeline, ReplayNode } from './types.js';

function renderTree(node: ReplayNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const focusClass = node.focused ? ' class="focused"' : '';
  const id = node.id ? ` <span class="id">#${escapeHtml(node.id)}</span>` : '';
  const tag = `<span class="tag">${escapeHtml(node.tag)}</span>`;

  if (node.children.length === 0) {
    return `${indent}<div${focusClass}>${tag}${id}</div>`;
  }

  const children = node.children.map((c) => renderTree(c, depth + 1)).join('\n');
  return `${indent}<div${focusClass}>${tag}${id}\n${children}\n${indent}</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateReplayHtml(timeline: ReplayTimeline): string {
  const framesJson = JSON.stringify(timeline.frames);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Uncle Jesse Replay: ${escapeHtml(timeline.testName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
  h1 { font-size: 16px; margin-bottom: 12px; color: #a0a0a0; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-left: 8px; }
  .status.pass { background: #2d5a2d; color: #90ee90; }
  .status.fail { background: #5a2d2d; color: #ee9090; }

  .controls { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: #16213e; border-radius: 4px; }
  .controls button { background: #0f3460; color: #e0e0e0; border: 1px solid #333; padding: 6px 14px; cursor: pointer; border-radius: 3px; font-family: monospace; }
  .controls button:hover { background: #1a4a7a; }
  .controls button:disabled { opacity: 0.4; cursor: default; }
  .scrubber { flex: 1; }
  input[type=range] { width: 100%; accent-color: #e94560; }
  .step-label { font-size: 13px; min-width: 80px; }

  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .panel { background: #16213e; border-radius: 4px; padding: 16px; overflow: auto; max-height: 70vh; }
  .panel h2 { font-size: 13px; color: #a0a0a0; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 6px; }

  .info-row { display: flex; gap: 16px; margin-bottom: 6px; font-size: 13px; }
  .info-row .label { color: #888; min-width: 80px; }
  .info-row .value { color: #e0e0e0; }
  .info-row .value.pass { color: #90ee90; }
  .info-row .value.fail { color: #ee9090; }

  .tree div { padding: 1px 0 1px 16px; border-left: 1px solid #333; font-size: 12px; line-height: 1.6; }
  .tree .focused { background: #2a1a3e; border-left-color: #e94560; }
  .tree .focused > .tag { color: #e94560; font-weight: bold; }
  .tree .tag { color: #7ec8e3; }
  .tree .id { color: #c8a87e; }

  @media (max-width: 700px) {
    .panels { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<h1>
  ${escapeHtml(timeline.testName)}
  <span class="status ${timeline.passed ? 'pass' : 'fail'}">${timeline.passed ? 'PASSED' : 'FAILED'}</span>
</h1>

<div class="controls">
  <button id="prev" title="Previous step">&lt;</button>
  <div class="scrubber">
    <input type="range" id="slider" min="0" max="${timeline.frames.length - 1}" value="0">
  </div>
  <button id="next" title="Next step">&gt;</button>
  <span class="step-label" id="stepLabel">Step 1/${timeline.frames.length}</span>
</div>

<div class="panels">
  <div class="panel">
    <h2>Step Details</h2>
    <div id="details"></div>
  </div>
  <div class="panel">
    <h2>UI Tree</h2>
    <div id="tree" class="tree"></div>
  </div>
</div>

<script>
const frames = ${framesJson};
const slider = document.getElementById('slider');
const stepLabel = document.getElementById('stepLabel');
const details = document.getElementById('details');
const tree = document.getElementById('tree');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

function renderNode(node, depth) {
  const focusClass = node.focused ? ' class="focused"' : '';
  const id = node.id ? ' <span class="id">#' + node.id + '</span>' : '';
  const tag = '<span class="tag">' + node.tag + '</span>';
  let html = '<div' + focusClass + '>' + tag + id;
  for (const child of node.children) {
    html += renderNode(child, depth + 1);
  }
  html += '</div>';
  return html;
}

function showFrame(idx) {
  const f = frames[idx];
  stepLabel.textContent = 'Step ' + f.step + '/' + frames.length;
  slider.value = idx;
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === frames.length - 1;

  details.innerHTML =
    '<div class="info-row"><span class="label">Key</span><span class="value">' + f.key.toUpperCase() + '</span></div>' +
    '<div class="info-row"><span class="label">Expected</span><span class="value">' + f.expectedSelector + '</span></div>' +
    '<div class="info-row"><span class="label">Actual</span><span class="value">' + (f.actualFocusId ? '#' + f.actualFocusId : '&lt;nothing&gt;') + '</span></div>' +
    '<div class="info-row"><span class="label">Result</span><span class="value ' + (f.passed ? 'pass' : 'fail') + '">' + (f.passed ? 'PASS' : 'FAIL') + '</span></div>' +
    '<div class="info-row"><span class="label">Time</span><span class="value">' + f.timestamp + 'ms</span></div>';

  tree.innerHTML = renderNode(f.uiTree, 0);
}

slider.addEventListener('input', () => showFrame(Number(slider.value)));
prevBtn.addEventListener('click', () => { if (slider.value > 0) showFrame(Number(slider.value) - 1); });
nextBtn.addEventListener('click', () => { if (slider.value < frames.length - 1) showFrame(Number(slider.value) + 1); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') prevBtn.click();
  if (e.key === 'ArrowRight') nextBtn.click();
});

showFrame(0);
</script>
</body>
</html>`;
}
