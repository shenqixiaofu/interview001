import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Conversation, PersistedState } from "./types";

export class ConversationStore {
  private readonly statePath: string;
  private state: PersistedState;

  constructor(userDataPath: string, projectPath: string) {
    this.statePath = path.join(userDataPath, "state.json");
    this.state = { conversations: [], settings: { projectPath } };
  }

  // 启动时只读取一个状态文件，避免引入额外数据库依赖。
  async load(): Promise<void> {
    try {
      const content = await readFile(this.statePath, "utf8");
      this.state = JSON.parse(content) as PersistedState;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      await this.save();
    }
  }

  getState(): PersistedState {
    return structuredClone(this.state);
  }

  getConversation(id: string): Conversation | undefined {
    return this.state.conversations.find((item) => item.id === id);
  }

  async createConversation(): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: randomUUID(),
      title: "新对话",
      model: "sonnet",
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    this.state.conversations.unshift(conversation);
    await this.save();
    return structuredClone(conversation);
  }

  async deleteConversation(id: string): Promise<PersistedState> {
    this.state.conversations = this.state.conversations.filter((item) => item.id !== id);
    await this.save();
    return this.getState();
  }

  async updateConversation(id: string, update: Partial<Conversation>): Promise<Conversation> {
    const conversation = this.getConversation(id);
    if (!conversation) throw new Error("会话不存在");
    Object.assign(conversation, update, { updatedAt: new Date().toISOString() });
    this.sortConversations();
    await this.save();
    return structuredClone(conversation);
  }

  async updateProjectPath(projectPath: string): Promise<void> {
    this.state.settings.projectPath = projectPath;
    await this.save();
  }

  private sortConversations(): void {
    this.state.conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async save(): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
