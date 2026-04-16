import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter, TestResult, SuiteResult } from './types.js';

interface CtrfTest {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'other';
  duration: number;
  suite?: string[];
  message?: string;
  trace?: string;
  device?: string;
  type?: string;
  screenshot?: string;
  steps?: Array<{ name: string; status: string }>;
}

interface CtrfReport {
  reportFormat: 'CTRF';
  specVersion: string;
  timestamp?: string;
  generatedBy?: string;
  results: {
    tool: { name: string; version?: string };
    summary: {
      tests: number;
      passed: number;
      failed: number;
      skipped: number;
      pending: number;
      other: number;
      start: number;
      stop: number;
      duration?: number;
    };
    environment?: Record<string, unknown>;
    tests: CtrfTest[];
  };
}

export interface CtrfReporterOptions {
  outputDir?: string;
  outputFile?: string;
  deviceName?: string;
  appName?: string;
  appVersion?: string;
  buildId?: string;
  testEnvironment?: string;
}

export class CtrfReporter implements Reporter {
  private tests: CtrfTest[] = [];
  private suites: SuiteResult[] = [];
  private currentSuite: string | null = null;
  private startTime: number;
  private options: CtrfReporterOptions;

  constructor(options?: CtrfReporterOptions) {
    this.options = options ?? {};
    this.startTime = Date.now();
  }

  onSuiteStart(name: string): void {
    this.currentSuite = name;
  }

  onTestResult(result: TestResult): void {
    const test: CtrfTest = {
      name: result.name,
      status: this.mapStatus(result.status),
      duration: result.duration,
      type: 'e2e',
    };

    if (this.currentSuite) {
      test.suite = [this.currentSuite];
    }

    if (this.options.deviceName) {
      test.device = this.options.deviceName;
    }

    if (result.error) {
      test.message = result.error;
    }

    if (result.failures && result.failures.length > 0) {
      test.message = result.failures.map((f) => f.message).join('\n');
      test.steps = result.failures.map((f) => ({
        name: `Step ${f.step}`,
        status: 'failed',
      }));
    }

    this.tests.push(test);
  }

  onSuiteEnd(suite: SuiteResult): void {
    this.suites.push(suite);
  }

  getOutput(): string {
    const stopTime = Date.now();

    const passed = this.tests.filter((t) => t.status === 'passed').length;
    const failed = this.tests.filter((t) => t.status === 'failed').length;
    const skipped = this.tests.filter((t) => t.status === 'skipped').length;
    const pending = this.tests.filter((t) => t.status === 'pending').length;
    const other = this.tests.filter((t) => t.status === 'other').length;

    const report: CtrfReport = {
      reportFormat: 'CTRF',
      specVersion: '0.0.0',
      timestamp: new Date().toISOString(),
      generatedBy: 'uncle-jesse',
      results: {
        tool: {
          name: 'uncle-jesse',
          version: '1.1.1',
        },
        summary: {
          tests: this.tests.length,
          passed,
          failed,
          skipped,
          pending,
          other,
          start: this.startTime,
          stop: stopTime,
          duration: stopTime - this.startTime,
        },
        tests: this.tests,
      },
    };

    if (this.options.appName || this.options.buildId || this.options.testEnvironment) {
      report.results.environment = {};
      if (this.options.appName) report.results.environment.appName = this.options.appName;
      if (this.options.appVersion) report.results.environment.appVersion = this.options.appVersion;
      if (this.options.buildId) report.results.environment.buildId = this.options.buildId;
      if (this.options.testEnvironment) report.results.environment.testEnvironment = this.options.testEnvironment;
    }

    return JSON.stringify(report, null, 2);
  }

  save(): string {
    const dir = this.options.outputDir ?? './test-results';
    const file = this.options.outputFile ?? 'ctrf-report.json';
    const path = join(dir, file);

    mkdirSync(dir, { recursive: true });
    writeFileSync(path, this.getOutput(), 'utf-8');

    return path;
  }

  private mapStatus(status: string): CtrfTest['status'] {
    switch (status) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      case 'skipped': return 'skipped';
      case 'errored': return 'other';
      default: return 'other';
    }
  }
}
