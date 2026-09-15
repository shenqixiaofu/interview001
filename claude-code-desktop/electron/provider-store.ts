import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeStorage } from "electron";
import type { ProviderConfig, ProviderInput, ProviderState } from "./types";

interface StoredProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  encryptedApiKey: string;
}

interface StoredProviderState {
  providers: StoredProvider[];
  activeProviderId: string | null;
}

export class ProviderStore {
  private readonly statePath: string;
  private state: StoredProviderState = { providers: [], activeProviderId: null };

  constructor(userDataPath: string) {
    this.statePath = path.join(userDataPath, "providers.json");
  }

  // Provider 配置与会话数据分开保存，避免明文凭据进入普通状态文件。
  async load(): Promise<void> {
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8")) as StoredProviderState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.save();
    }
  }

  getState(): ProviderState {
    return {
      providers: this.state.providers.map(({ encryptedApiKey, ...provider }) => ({
        ...provider,
        hasApiKey: Boolean(encryptedApiKey)
      })),
      activeProviderId: this.state.activeProviderId
    };
  }

  getActiveProvider(): ProviderConfig | null {
    const active = this.state.providers.find((provider) => provider.id === this.state.activeProviderId);
    return active ? { ...active, hasApiKey: Boolean(active.encryptedApiKey) } : null;
  }

  getApiKey(id: string): string {
    const provider = this.state.providers.find((item) => item.id === id);
    if (!provider) throw new Error("服务商配置不存在");
    if (!provider.encryptedApiKey) throw new Error("请先配置 API Key");
    return safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, "base64"));
  }

  async saveProvider(input: ProviderInput): Promise<ProviderState> {
    const name = input.name.trim();
    const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    const models = [...new Set(input.models.map((model) => model.trim()).filter(Boolean))];
    if (!name || !baseUrl) throw new Error("服务商名称和 Base URL 不能为空");

    const existing = input.id ? this.state.providers.find((item) => item.id === input.id) : undefined;
    const id = existing?.id ?? randomUUID();
    const apiKey = input.apiKey?.trim();
    const encryptedApiKey = apiKey
      ? safeStorage.encryptString(apiKey).toString("base64")
      : existing?.encryptedApiKey ?? "";
    const provider: StoredProvider = { id, name, baseUrl, models, encryptedApiKey };

    this.state.providers = existing
      ? this.state.providers.map((item) => (item.id === id ? provider : item))
      : [...this.state.providers, provider];
    this.state.activeProviderId = this.state.activeProviderId ?? id;
    await this.save();
    return this.getState();
  }

  async deleteProvider(id: string): Promise<ProviderState> {
    this.state.providers = this.state.providers.filter((provider) => provider.id !== id);
    if (this.state.activeProviderId === id) this.state.activeProviderId = this.state.providers[0]?.id ?? null;
    await this.save();
    return this.getState();
  }

  async selectProvider(id: string): Promise<ProviderState> {
    if (!this.state.providers.some((provider) => provider.id === id)) throw new Error("服务商配置不存在");
    this.state.activeProviderId = id;
    await this.save();
    return this.getState();
  }

  private async save(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
