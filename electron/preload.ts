import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, StreamChunk, StreamDone, StreamError } from "./types";

// 白名单 API 隔离渲染进程与 Node.js 系统能力。
const desktopApi: DesktopApi = {
  getBootstrap: () => ipcRenderer.invoke("app:get-bootstrap"),
  createConversation: () => ipcRenderer.invoke("conversation:create"),
  deleteConversation: (id) => ipcRenderer.invoke("conversation:delete", id),
  updateConversationModel: (id, model) => ipcRenderer.invoke("conversation:model", id, model),
  chooseProject: () => ipcRenderer.invoke("project:choose"),
  sendMessage: (conversationId, prompt) => ipcRenderer.invoke("chat:send", conversationId, prompt),
  stopGeneration: (conversationId) => ipcRenderer.invoke("chat:stop", conversationId),
  onChunk: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: StreamChunk) => callback(payload);
    ipcRenderer.on("chat:chunk", listener);
    return () => ipcRenderer.removeListener("chat:chunk", listener);
  },
  onDone: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: StreamDone) => callback(payload);
    ipcRenderer.on("chat:done", listener);
    return () => ipcRenderer.removeListener("chat:done", listener);
  },
  onError: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: StreamError) => callback(payload);
    ipcRenderer.on("chat:error", listener);
    return () => ipcRenderer.removeListener("chat:error", listener);
  }
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
