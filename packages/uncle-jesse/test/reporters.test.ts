import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsoleReporter } from '../src/reporters/console.js';
import { JunitReporter } from '../src/reporters/junit.js';
import { CtrfReporter } from '../src/reporters/ctrf.js';
import type { SuiteResult, TestResult } from '../src/reporters/types.js';

const passedTest: TestResult = {
  name: 'navigates to hero item',
  status: 'passed',
  duration: 150,
};

const failedTest: TestResult = {
  name: 'focuses correct item after right press',
  status: 'failed',
  duration: 230,
  failures: [
    { step: 1, message: 'Step 1: After pressing RIGHT, expected focus on #heroItem1 but found focus on #heroItem0' },
  ],
};

const erroredTest: TestResult = {
  name: 'connects to device',
  status: 'errored',
  duration: 5000,
  error: 'Device unreachable: 192.168.1.100',
};

const suite: SuiteResult = {
  name: 'Hero Carousel',
  tests: [passedTest, failedTest, erroredTest],
  duration: 5380,
};

describe('ConsoleReporter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('outputs pass/fail/error results', () => {
    const reporter = new ConsoleReporter();
    reporter.onSuiteStart(suite.name);
    for (const test of suite.tests) reporter.onTestResult(test);
    reporter.onSuiteEnd(suite);

    const output = reporter.getOutput();
    expect(output).toContain('PASS');
    expect(output).toContain('FAIL');
    expect(output).toContain('ERROR');
    expect(output).toContain('Hero Carousel');
    expect(output).toContain('1 passed');
    expect(output).toContain('1 failed');
    expect(output).toContain('1 errored');
  });
});

describe('JunitReporter', () => {
  it('produces valid JUnit XML', () => {
    const reporter = new JunitReporter();
    reporter.onSuiteStart(suite.name);
    for (const test of suite.tests) reporter.onTestResult(test);
    reporter.onSuiteEnd(suite);

    const xml = reporter.getOutput();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<testsuites>');
    expect(xml).toContain('name="Hero Carousel"');
    expect(xml).toContain('tests="3"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('errors="1"');
    expect(xml).toContain('<failure');
    expect(xml).toContain('<error');
    expect(xml).toContain('</testsuites>');
  });

  it('escapes XML special characters', () => {
    const reporter = new JunitReporter();
    const specialTest: TestResult = {
      name: 'test with <special> & "chars"',
      status: 'passed',
      duration: 10,
    };
    reporter.onSuiteStart('Suite');
    reporter.onTestResult(specialTest);
    reporter.onSuiteEnd({ name: 'Suite', tests: [specialTest], duration: 10 });

    const xml = reporter.getOutput();
    expect(xml).toContain('&lt;special&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;chars&quot;');
    expect(xml).not.toContain('<special>');
  });
});

describe('CtrfReporter', () => {
  it('produces valid CTRF JSON', () => {
    const reporter = new CtrfReporter({ deviceName: 'Roku Ultra' });
    reporter.onSuiteStart(suite.name);
    for (const test of suite.tests) reporter.onTestResult(test);
    reporter.onSuiteEnd(suite);

    const output = JSON.parse(reporter.getOutput());
    expect(output.reportFormat).toBe('CTRF');
    expect(output.specVersion).toBe('0.0.0');
    expect(output.generatedBy).toBe('uncle-jesse');
    expect(output.results.tool.name).toBe('uncle-jesse');
    expect(output.results.summary.tests).toBe(3);
    expect(output.results.summary.passed).toBe(1);
    expect(output.results.summary.failed).toBe(1);
    expect(output.results.summary.other).toBe(1);
    expect(output.results.tests).toHaveLength(3);
  });

  it('includes device name on test results', () => {
    const reporter = new CtrfReporter({ deviceName: 'Roku Ultra' });
    reporter.onSuiteStart('Suite');
    reporter.onTestResult(passedTest);
    reporter.onSuiteEnd({ name: 'Suite', tests: [passedTest], duration: 150 });

    const output = JSON.parse(reporter.getOutput());
    expect(output.results.tests[0].device).toBe('Roku Ultra');
  });

  it('includes suite hierarchy', () => {
    const reporter = new CtrfReporter();
    reporter.onSuiteStart('Hero Carousel');
    reporter.onTestResult(passedTest);
    reporter.onSuiteEnd({ name: 'Hero Carousel', tests: [passedTest], duration: 150 });

    const output = JSON.parse(reporter.getOutput());
    expect(output.results.tests[0].suite).toEqual(['Hero Carousel']);
  });

  it('includes environment metadata', () => {
    const reporter = new CtrfReporter({
      appName: 'MyApp',
      appVersion: '2.0.0',
      buildId: 'build-123',
      testEnvironment: 'staging',
    });
    reporter.onSuiteStart('Suite');
    reporter.onTestResult(passedTest);
    reporter.onSuiteEnd({ name: 'Suite', tests: [passedTest], duration: 150 });

    const output = JSON.parse(reporter.getOutput());
    expect(output.results.environment.appName).toBe('MyApp');
    expect(output.results.environment.appVersion).toBe('2.0.0');
    expect(output.results.environment.buildId).toBe('build-123');
    expect(output.results.environment.testEnvironment).toBe('staging');
  });

  it('includes failure messages and steps from focusPath', () => {
    const reporter = new CtrfReporter();
    reporter.onSuiteStart('Suite');
    reporter.onTestResult(failedTest);
    reporter.onSuiteEnd({ name: 'Suite', tests: [failedTest], duration: 230 });

    const output = JSON.parse(reporter.getOutput());
    const test = output.results.tests[0];
    expect(test.status).toBe('failed');
    expect(test.message).toContain('Step 1');
    expect(test.steps).toHaveLength(1);
    expect(test.steps[0].name).toBe('Step 1');
    expect(test.steps[0].status).toBe('failed');
  });

  it('maps errored status to other', () => {
    const reporter = new CtrfReporter();
    reporter.onSuiteStart('Suite');
    reporter.onTestResult(erroredTest);
    reporter.onSuiteEnd({ name: 'Suite', tests: [erroredTest], duration: 5000 });

    const output = JSON.parse(reporter.getOutput());
    expect(output.results.tests[0].status).toBe('other');
    expect(output.results.tests[0].message).toBe('Device unreachable: 192.168.1.100');
  });
});
