import { randomUUID } from "node:crypto";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ClaudeRunner } from "./claude-runner";
import { ConversationStore } from "./store";
import type { ChatMessage } from "./types";

let mainWindow: BrowserWindow;
let store: ConversationStore;
const runner = new ClaudeRunner();

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
    return { ...store.getState(), claudeAvailable: Boolean(claudeVersion), claudeVersion };
  });

  ipcMain.handle("conversation:create", () => store.createConversation());
  ipcMain.handle("conversation:delete", (_event, id: string) => store.deleteConversation(id));
  ipcMain.handle("conversation:model", (_event, id: string, model: string) =>
    store.updateConversation(id, { model })
  );

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
        const errorText = error.message === "生成已停止" ? content || "生成已停止。" : content || error.message;
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
  await store.load();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
