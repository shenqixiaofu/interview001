import { MessageSquare, Plus, TerminalSquare, Trash2, X } from "lucide-react";
import type { Conversation } from "../../electron/types";

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className={`sidebar ${props.open ? "sidebar--open" : ""}`} aria-label="会话导航">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true"><TerminalSquare size={19} /></div>
        <div className="brand-copy">
          <strong>Claude Code</strong>
          <span>Desktop</span>
        </div>
        <button className="icon-button mobile-close" onClick={props.onClose} title="关闭会话栏" aria-label="关闭会话栏">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-heading">
        <span>会话</span>
        <button className="icon-button" onClick={props.onCreate} title="新建会话" aria-label="新建会话">
          <Plus size={18} />
        </button>
      </div>

      <nav className="conversation-list">
        {props.conversations.map((conversation) => (
          <div
            className={`conversation-item ${conversation.id === props.selectedId ? "conversation-item--active" : ""}`}
            key={conversation.id}
          >
            <button className="conversation-main" onClick={() => props.onSelect(conversation.id)}>
              <MessageSquare size={15} aria-hidden="true" />
              <span className="conversation-copy">
                <strong>{conversation.title}</strong>
                <small>{conversation.model} · {formatDate(conversation.updatedAt)}</small>
              </span>
            </button>
            <button
              className="delete-button"
              onClick={() => props.onDelete(conversation.id)}
              title="删除会话"
              aria-label={`删除会话：${conversation.title}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="status-dot" aria-hidden="true" />
        本地会话
      </div>
    </aside>
  );
}
