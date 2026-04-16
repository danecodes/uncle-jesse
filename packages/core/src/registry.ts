export type RegistryData = Record<string, Record<string, string>>;

export interface OdcClient {
  setRegistry(data: RegistryData): Promise<void>;
  clearRegistry(sections?: string[]): Promise<void>;
  getRegistry(): Promise<RegistryData>;
}

export class RegistryState {
  private data: RegistryData = {};

  set(section: string, key: string, value: string): this {
    if (!this.data[section]) this.data[section] = {};
    this.data[section][key] = value;
    return this;
  }

  merge(other: RegistryData): this {
    for (const [section, values] of Object.entries(other)) {
      if (!this.data[section]) this.data[section] = {};
      Object.assign(this.data[section], values);
    }
    return this;
  }

  toJSON(): RegistryData {
    return { ...this.data };
  }

  toLaunchParams(options?: { clearRegistry?: boolean }): Record<string, string> {
    const params: Record<string, string> = {};
    if (options?.clearRegistry !== false) {
      params['odc_clear_registry'] = 'true';
    }
    if (Object.keys(this.data).length > 0) {
      params['odc_registry'] = JSON.stringify(this.data);
    }
    return params;
  }

  async applyViaOdc(odc: OdcClient, options?: { clearFirst?: boolean }): Promise<void> {
    if (options?.clearFirst !== false) {
      await odc.clearRegistry();
    }
    if (Object.keys(this.data).length > 0) {
      await odc.setRegistry(this.data);
    }
  }

  static async readFromDevice(odc: OdcClient): Promise<RegistryState> {
    const data = await odc.getRegistry();
    return RegistryState.from(data);
  }

  static skipOnboarding(): RegistryState {
    return new RegistryState().set('APP_CONFIG', 'isFirstLaunch', 'false');
  }

  static authenticated(): RegistryState {
    return RegistryState.skipOnboarding();
  }

  static from(data: RegistryData): RegistryState {
    const state = new RegistryState();
    state.merge(data);
    return state;
  }
}
