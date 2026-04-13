import type { UIElement } from '@uncle-jesse/core';
import type { ReplayFrame, ReplayNode, ReplayTimeline } from './types.js';

function elementToReplayNode(el: UIElement): ReplayNode {
  return {
    tag: el.tag,
    id: el.id,
    attrs: { ...el.attributes },
    focused: el.focused,
    children: el.children.map(elementToReplayNode),
  };
}

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private startTime: number;
  private testName: string;

  constructor(testName: string) {
    this.testName = testName;
    this.startTime = Date.now();
  }

  recordStep(
    step: number,
    key: string,
    expectedSelector: string,
    actualFocusId: string | undefined,
    passed: boolean,
    uiTree: UIElement,
  ): void {
    this.frames.push({
      step,
      key,
      expectedSelector,
      actualFocusId,
      passed,
      timestamp: Date.now() - this.startTime,
      uiTree: elementToReplayNode(uiTree),
    });
  }

  toTimeline(): ReplayTimeline {
    return {
      testName: this.testName,
      startTime: this.startTime,
      frames: this.frames,
      passed: this.frames.every((f) => f.passed),
    };
  }

  toJSON(): string {
    return JSON.stringify(this.toTimeline(), null, 2);
  }
}
