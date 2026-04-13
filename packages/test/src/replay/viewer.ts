import type { ReplayTimeline, ReplayNode } from './types.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateReplayHtml(timeline: ReplayTimeline): string {
  const hasScreenshots = timeline.frames.some((f) => f.screenshot);

  // Strip screenshots from the inlined JSON to keep the script block small.
  // Store them separately as a base64 array.
  const framesForJson = timeline.frames.map(({ screenshot, ...rest }) => rest);
  const framesJson = JSON.stringify(framesForJson);
  const screenshotsJson = JSON.stringify(timeline.frames.map((f) => f.screenshot ?? null));

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

  .main { display: flex; gap: 16px; }
  .left { flex: 1; min-width: 0; }
  .right { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }

  .panel { background: #16213e; border-radius: 4px; padding: 16px; overflow: auto; }
  .panel h2 { font-size: 13px; color: #a0a0a0; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 6px; }

  .screenshot-panel img { width: 100%; border-radius: 2px; display: block; }
  .screenshot-panel .no-screenshot { color: #555; font-size: 12px; }

  .info-row { display: flex; gap: 16px; margin-bottom: 6px; font-size: 13px; }
  .info-row .label { color: #888; min-width: 80px; }
  .info-row .value { color: #e0e0e0; }
  .info-row .value.pass { color: #90ee90; }
  .info-row .value.fail { color: #ee9090; }

  .tree { max-height: 50vh; overflow: auto; }
  .tree div { padding: 1px 0 1px 16px; border-left: 1px solid #333; font-size: 12px; line-height: 1.6; }
  .tree .focused { background: #2a1a3e; border-left-color: #e94560; }
  .tree .focused > .tag { color: #e94560; font-weight: bold; }
  .tree .tag { color: #7ec8e3; }
  .tree .id { color: #c8a87e; }

  @media (max-width: 800px) {
    .main { flex-direction: column; }
    .right { width: 100%; }
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

<div class="main">
  <div class="left">
    <div class="panel screenshot-panel">
      <h2>Screenshot</h2>
      <div id="screenshot"></div>
    </div>
  </div>
  <div class="right">
    <div class="panel">
      <h2>Step Details</h2>
      <div id="details"></div>
    </div>
    <div class="panel">
      <h2>UI Tree</h2>
      <div id="tree" class="tree"></div>
    </div>
  </div>
</div>

<script>
var frames = ${framesJson};
var screenshots = ${screenshotsJson};
var slider = document.getElementById('slider');
var stepLabel = document.getElementById('stepLabel');
var details = document.getElementById('details');
var tree = document.getElementById('tree');
var screenshotEl = document.getElementById('screenshot');
var prevBtn = document.getElementById('prev');
var nextBtn = document.getElementById('next');

function renderNode(node, depth) {
  var focusClass = node.focused ? ' class="focused"' : '';
  var id = node.id ? ' <span class="id">#' + node.id + '</span>' : '';
  var tag = '<span class="tag">' + node.tag + '</span>';
  var html = '<div' + focusClass + '>' + tag + id;
  for (var i = 0; i < node.children.length; i++) {
    html += renderNode(node.children[i], depth + 1);
  }
  html += '</div>';
  return html;
}

function showFrame(idx) {
  var f = frames[idx];
  var ss = screenshots[idx];
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

  if (ss) {
    screenshotEl.innerHTML = '<img src="data:image/png;base64,' + ss + '" alt="Step ' + f.step + ' screenshot">';
  } else {
    screenshotEl.innerHTML = '<span class="no-screenshot">No screenshot available</span>';
  }

  tree.innerHTML = renderNode(f.uiTree, 0);
}

slider.addEventListener('input', function() { showFrame(Number(slider.value)); });
prevBtn.addEventListener('click', function() { if (slider.value > 0) showFrame(Number(slider.value) - 1); });
nextBtn.addEventListener('click', function() { if (slider.value < frames.length - 1) showFrame(Number(slider.value) + 1); });

document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft') prevBtn.click();
  if (e.key === 'ArrowRight') nextBtn.click();
});

showFrame(0);
</script>
</body>
</html>`;
}
