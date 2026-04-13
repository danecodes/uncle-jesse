export class TimeoutError extends Error {
  readonly selector: string;
  readonly elapsed: number;
  readonly lastUITree: unknown;

  constructor(selector: string, elapsed: number, lastUITree?: unknown) {
    super(
      `Timed out after ${elapsed}ms waiting for selector: ${selector}`,
    );
    this.name = 'TimeoutError';
    this.selector = selector;
    this.elapsed = elapsed;
    this.lastUITree = lastUITree;
  }
}

export class DeviceConnectionError extends Error {
  readonly ip: string;

  constructor(ip: string, cause?: Error) {
    super(`Device unreachable: ${ip}`);
    this.name = 'DeviceConnectionError';
    this.ip = ip;
    if (cause) this.cause = cause;
  }
}

export class ECPError extends Error {
  readonly statusCode: number;
  readonly endpoint: string;

  constructor(statusCode: number, endpoint: string) {
    super(`ECP request failed: ${endpoint} returned ${statusCode}`);
    this.name = 'ECPError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}
