import { describe, it, expect } from 'vitest';
import { UIElement, setDefaultQueryEngine, SelectorEngine } from '@danecodes/uncle-jesse-core';
import { ReplayRecorder } from '../src/replay/recorder.js';
import { generateReplayHtml } from '../src/replay/viewer.js';

setDefaultQueryEngine(new SelectorEngine());

function makeTree(): UIElement {
  const child1 = new UIElement('Button', { name: 'btn1', focused: 'true' }, [], null);
  const child2 = new UIElement('Button', { name: 'btn2', focused: 'false' }, [], null);
  const root = new UIElement('Scene', {}, [child1, child2], null);
  (child1 as { parent: UIElement | null }).parent = root;
  (child2 as { parent: UIElement | null }).parent = root;
  return root;
}

describe('ReplayRecorder', () => {
  it('records steps into a timeline', () => {
    const recorder = new ReplayRecorder('test nav');
    const tree = makeTree();

    recorder.recordStep(1, 'right', '#btn1', 'btn1', true, tree);
    recorder.recordStep(2, 'right', '#btn2', 'btn1', false, tree);

    const timeline = recorder.toTimeline();
    expect(timeline.testName).toBe('test nav');
    expect(timeline.frames).toHaveLength(2);
    expect(timeline.passed).toBe(false);

    expect(timeline.frames[0].passed).toBe(true);
    expect(timeline.frames[0].key).toBe('right');
    expect(timeline.frames[0].uiTree.tag).toBe('Scene');
    expect(timeline.frames[0].uiTree.children).toHaveLength(2);
    expect(timeline.frames[0].uiTree.children[0].focused).toBe(true);

    expect(timeline.frames[1].passed).toBe(false);
    expect(timeline.frames[1].actualFocusId).toBe('btn1');
    expect(timeline.frames[1].expectedSelector).toBe('#btn2');
  });

  it('serializes to JSON', () => {
    const recorder = new ReplayRecorder('json test');
    recorder.recordStep(1, 'select', '#x', 'x', true, makeTree());

    const json = recorder.toJSON();
    const parsed = JSON.parse(json);
    expect(parsed.testName).toBe('json test');
    expect(parsed.frames).toHaveLength(1);
  });
});

describe('generateReplayHtml', () => {
  it('produces a self-contained HTML document', () => {
    const recorder = new ReplayRecorder('html test');
    recorder.recordStep(1, 'right', '#btn1', 'btn1', true, makeTree());
    recorder.recordStep(2, 'down', '#btn2', undefined, false, makeTree());

    const html = generateReplayHtml(recorder.toTimeline());

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('html test');
    expect(html).toContain('FAILED');
    expect(html).toContain('var frames =');
    expect(html).toContain('Step 1');
    // Contains the slider
    expect(html).toContain('input type="range"');
    // Contains tree rendering
    expect(html).toContain('renderNode');
  });

  it('escapes HTML in test names', () => {
    const recorder = new ReplayRecorder('test <script>alert(1)</script>');
    recorder.recordStep(1, 'right', '#a', 'a', true, makeTree());

    const html = generateReplayHtml(recorder.toTimeline());
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
