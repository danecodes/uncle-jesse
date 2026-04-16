import type { TVDevice } from '@danecodes/uncle-jesse-core';

export interface MockServerLike {
  start(): Promise<void>;
  stop(): Promise<void>;
  get baseUrl(): string;
  readonly recorder: {
    requests: Array<{ method: string; path: string; timestamp: Date }>;
    clear(): void;
  };
}

export interface MockScenarioLike {
  activate(name: string): void;
  deactivate(name: string): void;
  reset(): void;
}

export interface MockFixtureOptions {
  server: MockServerLike;
  scenarios?: MockScenarioLike;
  configureDevice?: (server: MockServerLike, device: TVDevice) => Promise<void>;
}

export class MockTestHelper {
  private server: MockServerLike;
  private scenarios: MockScenarioLike | null;
  private configure: ((server: MockServerLike, device: TVDevice) => Promise<void>) | null;

  constructor(options: MockFixtureOptions) {
    this.server = options.server;
    this.scenarios = options.scenarios ?? null;
    this.configure = options.configureDevice ?? null;
  }

  async setup(device: TVDevice): Promise<void> {
    await this.server.start();
    if (this.configure) {
      await this.configure(this.server, device);
    }
  }

  async teardown(): Promise<void> {
    if (this.scenarios) this.scenarios.reset();
    this.server.recorder.clear();
    await this.server.stop();
  }

  activateScenario(name: string): void {
    if (!this.scenarios) throw new Error('No scenario manager configured');
    this.scenarios.activate(name);
  }

  get requests() {
    return this.server.recorder.requests;
  }

  requestsTo(path: string) {
    return this.requests.filter((r) => r.path === path);
  }

  requestCount(path?: string): number {
    if (path) return this.requestsTo(path).length;
    return this.requests.length;
  }

  get baseUrl(): string {
    return this.server.baseUrl;
  }
}
