export interface ReplayFrame {
  step: number;
  key: string;
  expectedSelector: string;
  actualFocusId: string | undefined;
  passed: boolean;
  timestamp: number;
  uiTree: ReplayNode;
  screenshot?: string; // base64-encoded PNG
}

export interface ReplayNode {
  tag: string;
  id?: string;
  attrs: Record<string, string>;
  focused: boolean;
  children: ReplayNode[];
}

export interface ReplayTimeline {
  testName: string;
  startTime: number;
  frames: ReplayFrame[];
  passed: boolean;
}
