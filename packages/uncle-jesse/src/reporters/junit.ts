import type { Reporter, TestResult, SuiteResult } from './types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class JunitReporter implements Reporter {
  private suites: SuiteResult[] = [];
  private currentTests: TestResult[] = [];
  private currentName = '';

  onSuiteStart(name: string): void {
    this.currentName = name;
    this.currentTests = [];
  }

  onTestResult(result: TestResult): void {
    this.currentTests.push(result);
  }

  onSuiteEnd(suite: SuiteResult): void {
    this.suites.push(suite);
  }

  getOutput(): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push('<testsuites>');

    for (const suite of this.suites) {
      const failures = suite.tests.filter((t) => t.status === 'failed').length;
      const errors = suite.tests.filter((t) => t.status === 'errored').length;
      const skipped = suite.tests.filter((t) => t.status === 'skipped').length;

      lines.push(
        `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.tests.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${(suite.duration / 1000).toFixed(3)}">`,
      );

      for (const test of suite.tests) {
        const time = (test.duration / 1000).toFixed(3);

        if (test.status === 'passed') {
          lines.push(`    <testcase name="${escapeXml(test.name)}" time="${time}" />`);
        } else if (test.status === 'skipped') {
          lines.push(`    <testcase name="${escapeXml(test.name)}" time="${time}">`);
          lines.push('      <skipped />');
          lines.push('    </testcase>');
        } else if (test.status === 'failed') {
          lines.push(`    <testcase name="${escapeXml(test.name)}" time="${time}">`);
          const msg = test.failures?.map((f) => f.message).join('\n') ?? test.error ?? '';
          lines.push(`      <failure message="${escapeXml(msg.split('\n')[0])}">${escapeXml(msg)}</failure>`);
          lines.push('    </testcase>');
        } else if (test.status === 'errored') {
          lines.push(`    <testcase name="${escapeXml(test.name)}" time="${time}">`);
          lines.push(`      <error message="${escapeXml(test.error ?? 'Unknown error')}">${escapeXml(test.error ?? '')}</error>`);
          lines.push('    </testcase>');
        }
      }

      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');
    return lines.join('\n');
  }
}
