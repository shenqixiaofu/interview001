import { randomUUID } from "node:crypto";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ClaudeRunner } from "./claude-runner";
import { ConversationStore } from "./store";
import { ProviderStore } from "./provider-store";
import type { ChatMessage, ProviderInput } from "./types";

let mainWindow: BrowserWindow;
let store: ConversationStore;
let providerStore: ProviderStore;
let runner: ClaudeRunner;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: "#111416",
    title: "Claude Code Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) void mainWindow.loadURL(devServer);
  else void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

function registerIpc(): void {
  ipcMain.handle("app:get-bootstrap", async () => {
    if (store.getState().conversations.length === 0) await store.createConversation();
    const claudeVersion = await runner.getVersion();
    return { ...store.getState(), ...providerStore.getState(), claudeAvailable: Boolean(claudeVersion), claudeVersion };
  });

  ipcMain.handle("conversation:create", () => store.createConversation());
  ipcMain.handle("conversation:delete", (_event, id: string) => store.deleteConversation(id));
  ipcMain.handle("conversation:model", (_event, id: string, model: string) =>
    store.updateConversation(id, { model })
  );

  // Provider IPC 只向渲染层返回脱敏配置，API Key 始终留在主进程。
  ipcMain.handle("provider:save", (_event, input: ProviderInput) => providerStore.saveProvider(input));
  ipcMain.handle("provider:delete", (_event, id: string) => providerStore.deleteProvider(id));
  ipcMain.handle("provider:select", (_event, id: string) => providerStore.selectProvider(id));
  ipcMain.handle("provider:models", async (_event, input: ProviderInput) => {
    const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    const apiKey = input.apiKey?.trim() || (input.id ? providerStore.getApiKey(input.id) : "");
    if (!baseUrl || !apiKey) throw new Error("请先填写 Base URL 和 API Key");
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey }
    });
    if (!response.ok) throw new Error(`查询模型失败：HTTP ${response.status}`);
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    return (payload.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)).sort();
  });

  ipcMain.handle("project:choose", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择 Claude Code 工作目录",
      properties: ["openDirectory"]
    });
    if (!result.canceled && result.filePaths[0]) await store.updateProjectPath(result.filePaths[0]);
    return store.getState().settings;
  });

  ipcMain.handle("chat:send", async (_event, conversationId: string, rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    const conversation = store.getConversation(conversationId);
    if (!conversation) throw new Error("会话不存在");
    if (!prompt) throw new Error("消息不能为空");
    if (runner.isRunning(conversationId)) throw new Error("当前会话正在生成回复");
    const provider = providerStore.getActiveProvider();
    if (!provider) throw new Error("请先在设置中添加并选择服务商");
    const apiKey = providerStore.getApiKey(provider.id);

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: "user",
      content: prompt,
      createdAt: now,
      status: "complete"
    };
    const assistantMessage: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      content: "",
      createdAt: now,
      status: "streaming"
    };
    const title = conversation.messages.length === 0 ? prompt.replace(/\s+/g, " ").slice(0, 28) : conversation.title;
    const pendingConversation = await store.updateConversation(conversationId, {
      title,
      messages: [...conversation.messages, userMessage, assistantMessage]
    });

    let content = "";
    let sessionId = conversation.sessionId;
    void runner
      .run({
        conversationId,
        prompt,
        model: conversation.model,
        cwd: store.getState().settings.projectPath,
        baseUrl: provider.baseUrl,
        apiKey,
        sessionId,
        onText: (text) => {
          content += text;
          mainWindow.webContents.send("chat:chunk", { conversationId, messageId: assistantMessage.id, text });
        },
        onSession: (id) => {
          sessionId = id;
        }
      })
      .then(async () => {
        const current = store.getConversation(conversationId);
        if (!current) return;
        const messages = current.messages.map((message) =>
          message.id === assistantMessage.id ? { ...message, content, status: "complete" as const } : message
        );
        const updated = await store.updateConversation(conversationId, { messages, sessionId });
        mainWindow.webContents.send("chat:done", { conversation: updated });
      })
      .catch(async (error: Error) => {
        const current = store.getConversation(conversationId);
        if (!current) return;
        // 生成失败时保留已输出内容，同时把 CLI 原始错误拼上，避免 UI 吞掉关键诊断信息。
        const errorText = error.message === "生成已停止"
          ? content || "生成已停止。"
          : content
            ? `${content}\n\n[Claude Code 错误]\n${error.message}`
            : error.message;
        const messages = current.messages.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: errorText, status: "error" as const }
            : message
        );
        await store.updateConversation(conversationId, { messages, sessionId });
        mainWindow.webContents.send("chat:error", {
          conversationId,
          messageId: assistantMessage.id,
          message: errorText
        });
      });
    return pendingConversation;
  });

  ipcMain.handle("chat:stop", (_event, conversationId: string) => runner.stop(conversationId));
}

app.whenReady().then(async () => {
  store = new ConversationStore(app.getPath("userData"), app.getPath("home"));
  providerStore = new ProviderStore(app.getPath("userData"));
  // 调试日志统一落到 userData 目录，便于失败后直接回看。
  runner = new ClaudeRunner(path.join(app.getPath("userData"), "claude-debug"));
  await store.load();
  await providerStore.load();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
