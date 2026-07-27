import { useEffect, useMemo, useState } from "react";
import type { BootstrapData, Conversation, ProviderState, StreamChunk, StreamDone, StreamError } from "../electron/types";
import { ChatHeader } from "./components/ChatHeader";
import { Composer } from "./components/Composer";
import { MessageList } from "./components/MessageList";
import { ProviderSettings } from "./components/ProviderSettings";
import { Sidebar } from "./components/Sidebar";

function replaceConversation(items: Conversation[], next: Conversation): Conversation[] {
  const updated = items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [next, ...items];
  return updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const conversation = useMemo(
    () => data?.conversations.find((item) => item.id === selectedId) ?? null,
    [data?.conversations, selectedId]
  );

  useEffect(() => {
    let active = true;
    void window.desktopApi.getBootstrap().then((bootstrap) => {
      if (!active) return;
      setData(bootstrap);
      setSelectedId(bootstrap.conversations[0]?.id ?? null);
    });

    // 三类事件分别处理增量、正常结束和异常结束，避免重新拉取整个状态。
    const offChunk = window.desktopApi.onChunk((payload: StreamChunk) => {
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          conversations: current.conversations.map((item) =>
            item.id !== payload.conversationId
              ? item
              : {
                  ...item,
                  messages: item.messages.map((message) =>
                    message.id === payload.messageId
                      ? { ...message, content: message.content + payload.text }
                      : message
                  )
                }
          )
        };
      });
    });
    const offDone = window.desktopApi.onDone((payload: StreamDone) => {
      setData((current) => current && {
        ...current,
        conversations: replaceConversation(current.conversations, payload.conversation)
      });
      setRunningIds((current) => {
        const next = new Set(current);
        next.delete(payload.conversation.id);
        return next;
      });
    });
    const offError = window.desktopApi.onError((payload: StreamError) => {
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          conversations: current.conversations.map((item) =>
            item.id !== payload.conversationId
              ? item
              : {
                  ...item,
                  messages: item.messages.map((message) =>
                    message.id === payload.messageId
                      ? { ...message, content: payload.message, status: "error" }
                      : message
                  )
                }
          )
        };
      });
      setRunningIds((current) => {
        const next = new Set(current);
        next.delete(payload.conversationId);
        return next;
      });
      if (payload.message !== "生成已停止。") setNotice(payload.message);
    });

    return () => {
      active = false;
      offChunk();
      offDone();
      offError();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const createConversation = async (): Promise<void> => {
    const next = await window.desktopApi.createConversation();
    setData((current) => current && {
      ...current,
      conversations: replaceConversation(current.conversations, next)
    });
    setSelectedId(next.id);
    setSidebarOpen(false);
  };

  const deleteConversation = async (id: string): Promise<void> => {
    if (runningIds.has(id) || !window.confirm("确定删除这个会话吗？")) return;
    const state = await window.desktopApi.deleteConversation(id);
    setData((current) => current && { ...current, ...state });
    if (selectedId === id) setSelectedId(state.conversations[0]?.id ?? null);
  };

  const updateModel = async (model: string): Promise<void> => {
    if (!selectedId || runningIds.has(selectedId)) return;
    const updated = await window.desktopApi.updateConversationModel(selectedId, model);
    setData((current) => current && {
      ...current,
      conversations: replaceConversation(current.conversations, updated)
    });
  };

  const chooseProject = async (): Promise<void> => {
    const settings = await window.desktopApi.chooseProject();
    setData((current) => current && { ...current, settings });
  };

  const applyProviderState = (state: ProviderState): void => {
    setData((current) => current && { ...current, ...state });
  };

  const selectProvider = async (id: string): Promise<void> => {
    const state = await window.desktopApi.selectProvider(id);
    applyProviderState(state);
    const provider = state.providers.find((item) => item.id === id);
    if (selectedId && provider?.models[0] && !provider.models.includes(conversation?.model ?? "")) {
      await updateModel(provider.models[0]);
    }
  };

  const sendMessage = async (prompt: string): Promise<void> => {
    if (!selectedId) return;
    setRunningIds((current) => new Set(current).add(selectedId));
    try {
      const pending = await window.desktopApi.sendMessage(selectedId, prompt);
      setData((current) => current && {
        ...current,
        conversations: replaceConversation(current.conversations, pending)
      });
    } catch (error) {
      setRunningIds((current) => {
        const next = new Set(current);
        next.delete(selectedId);
        return next;
      });
      setNotice(error instanceof Error ? error.message : "发送失败");
    }
  };

  if (!data) {
    return (
      <div className="loading-screen" role="status">
        <span className="loading-mark" />
        <strong>正在连接 Claude Code</strong>
      </div>
    );
  }

  const running = selectedId ? runningIds.has(selectedId) : false;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到消息区</a>
      <Sidebar
        conversations={data.conversations}
        selectedId={selectedId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCreate={() => void createConversation()}
        onSelect={(id) => {
          setSelectedId(id);
          setSidebarOpen(false);
        }}
        onDelete={(id) => void deleteConversation(id)}
      />
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="关闭会话栏" />}
      <section className="workspace">
        <ChatHeader
          conversation={conversation}
          projectPath={data.settings.projectPath}
          claudeAvailable={data.claudeAvailable}
          claudeVersion={data.claudeVersion}
          providers={data.providers}
          activeProviderId={data.activeProviderId}
          onMenu={() => setSidebarOpen(true)}
          onModelChange={(model) => void updateModel(model)}
          onProviderChange={(id) => void selectProvider(id)}
          onOpenSettings={() => setSettingsOpen(true)}
          onChooseProject={() => void chooseProject()}
        />
        <MessageList conversation={conversation} />
        <Composer
          disabled={!conversation || !data.claudeAvailable || !data.activeProviderId}
          running={running}
          onSend={sendMessage}
          onStop={() => selectedId && void window.desktopApi.stopGeneration(selectedId)}
        />
      </section>
      {settingsOpen && (
        <ProviderSettings
          providers={data.providers}
          activeProviderId={data.activeProviderId}
          onClose={() => setSettingsOpen(false)}
          onChange={applyProviderState}
          onNotice={setNotice}
        />
      )}
      {notice && <div className="toast" role="alert">{notice}</div>}
    </div>
  );
}
