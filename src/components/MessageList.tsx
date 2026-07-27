import { Bot, CircleAlert, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Conversation } from "../../electron/types";

interface MessageListProps {
  conversation: Conversation | null;
}

export function MessageList({ conversation }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCount = conversation?.messages.length ?? 0;
  const lastContent = conversation?.messages.at(-1)?.content;

  // 新消息和流式内容到达后，将视线保持在最新内容。
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messageCount, lastContent]);

  if (!conversation || conversation.messages.length === 0) {
    return (
      <main className="message-scroll" id="main-content">
        <section className="empty-state">
          <div className="empty-icon"><Sparkles size={24} /></div>
          <h1>今天想构建什么？</h1>
          <p>从一个清晰的问题开始。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="message-scroll" id="main-content" aria-live="polite">
      <div className="message-column">
        {conversation.messages.map((message) => (
          <article className={`message message--${message.role}`} key={message.id}>
            <div className="message-avatar" aria-hidden="true">
              {message.role === "assistant" ? <Bot size={17} /> : <UserRound size={17} />}
            </div>
            <div className="message-body">
              <div className="message-meta">
                <strong>{message.role === "assistant" ? "Claude" : "你"}</strong>
                {message.status === "error" && <span className="error-label"><CircleAlert size={13} />未完成</span>}
              </div>
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                <div className="thinking" aria-label="Claude 正在思考">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </article>
        ))}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}
