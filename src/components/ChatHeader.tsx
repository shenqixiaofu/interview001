import { CheckCircle2, ChevronDown, FolderOpen, Menu, Terminal, XCircle } from "lucide-react";
import type { Conversation } from "../../electron/types";

interface ChatHeaderProps {
  conversation: Conversation | null;
  projectPath: string;
  claudeAvailable: boolean;
  claudeVersion: string;
  onMenu: () => void;
  onModelChange: (model: string) => void;
  onChooseProject: () => void;
}

export function ChatHeader(props: ChatHeaderProps) {
  const folderName = props.projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? props.projectPath;

  return (
    <header className="chat-header">
      <button className="icon-button menu-button" onClick={props.onMenu} title="打开会话栏" aria-label="打开会话栏">
        <Menu size={19} />
      </button>
      <div className="chat-title">
        <strong>{props.conversation?.title ?? "新对话"}</strong>
        <span className={props.claudeAvailable ? "cli-state cli-state--ready" : "cli-state cli-state--missing"}>
          {props.claudeAvailable ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {props.claudeAvailable ? props.claudeVersion : "未检测到 Claude Code"}
        </span>
      </div>

      <div className="header-actions">
        <button className="project-button" onClick={props.onChooseProject} title={props.projectPath}>
          <FolderOpen size={15} />
          <span>{folderName}</span>
        </button>
        <label className="model-select">
          <Terminal size={15} aria-hidden="true" />
          <span className="sr-only">模型</span>
          <select
            value={props.conversation?.model ?? "sonnet"}
            onChange={(event) => props.onModelChange(event.target.value)}
            disabled={!props.conversation}
          >
            <option value="sonnet">Sonnet</option>
            <option value="opus">Opus</option>
            <option value="haiku">Haiku</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      </div>
    </header>
  );
}
