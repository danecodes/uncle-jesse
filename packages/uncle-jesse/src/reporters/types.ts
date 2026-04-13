export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'errored' | 'skipped';
  duration: number;
  error?: string;
  failures?: Array<{ step: number; message: string }>;
}

export interface SuiteResult {
  name: string;
  tests: TestResult[];
  duration: number;
}

export interface Reporter {
  onSuiteStart(name: string): void;
  onTestResult(result: TestResult): void;
  onSuiteEnd(suite: SuiteResult): void;
  getOutput(): string;
}
