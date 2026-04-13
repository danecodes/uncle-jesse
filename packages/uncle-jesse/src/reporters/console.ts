import chalk from 'chalk';
import type { Reporter, TestResult, SuiteResult } from './types.js';

export class ConsoleReporter implements Reporter {
  private lines: string[] = [];

  onSuiteStart(name: string): void {
    const line = `\n${chalk.bold(name)}`;
    this.lines.push(line);
    console.log(line);
  }

  onTestResult(result: TestResult): void {
    const duration = chalk.dim(`(${result.duration}ms)`);
    let line: string;

    switch (result.status) {
      case 'passed':
        line = `  ${chalk.green('PASS')} ${result.name} ${duration}`;
        break;
      case 'failed':
        line = `  ${chalk.red('FAIL')} ${result.name} ${duration}`;
        if (result.failures) {
          for (const f of result.failures) {
            line += `\n    ${chalk.red(f.message)}`;
          }
        } else if (result.error) {
          line += `\n    ${chalk.red(result.error)}`;
        }
        break;
      case 'errored':
        line = `  ${chalk.yellow('ERROR')} ${result.name} ${duration}`;
        if (result.error) {
          line += `\n    ${chalk.yellow(result.error)}`;
        }
        break;
      case 'skipped':
        line = `  ${chalk.dim('SKIP')} ${result.name}`;
        break;
    }

    this.lines.push(line);
    console.log(line);
  }

  onSuiteEnd(suite: SuiteResult): void {
    const passed = suite.tests.filter((t) => t.status === 'passed').length;
    const failed = suite.tests.filter((t) => t.status === 'failed').length;
    const errored = suite.tests.filter((t) => t.status === 'errored').length;
    const total = suite.tests.length;

    const parts: string[] = [];
    if (passed > 0) parts.push(chalk.green(`${passed} passed`));
    if (failed > 0) parts.push(chalk.red(`${failed} failed`));
    if (errored > 0) parts.push(chalk.yellow(`${errored} errored`));

    const summary = `\n${parts.join(', ')} (${total} total) in ${suite.duration}ms`;
    this.lines.push(summary);
    console.log(summary);
  }

  getOutput(): string {
    return this.lines.join('\n');
  }
}
