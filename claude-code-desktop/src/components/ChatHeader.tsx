import { CheckCircle2, ChevronDown, FolderOpen, Menu, Settings, Terminal, XCircle } from "lucide-react";
import type { Conversation, ProviderConfig } from "../../electron/types";

interface ChatHeaderProps {
  conversation: Conversation | null;
  projectPath: string;
  claudeAvailable: boolean;
  claudeVersion: string;
  providers: ProviderConfig[];
  activeProviderId: string | null;
  onMenu: () => void;
  onModelChange: (model: string) => void;
  onProviderChange: (id: string) => void;
  onOpenSettings: () => void;
  onChooseProject: () => void;
}

export function ChatHeader(props: ChatHeaderProps) {
  const folderName = props.projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? props.projectPath;
  const activeProvider = props.providers.find((provider) => provider.id === props.activeProviderId);
  const models = activeProvider?.models ?? [];

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
        <label className="model-select provider-select">
          <span className="sr-only">服务商</span>
          <select
            value={props.activeProviderId ?? ""}
            onChange={(event) => props.onProviderChange(event.target.value)}
            disabled={props.providers.length === 0}
          >
            {props.providers.length === 0 && <option value="">未配置服务商</option>}
            {props.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
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
            {props.conversation && !models.includes(props.conversation.model) && (
              <option value={props.conversation.model}>{props.conversation.model}</option>
            )}
            {models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
        <button className="icon-button settings-button" onClick={props.onOpenSettings} title="服务商设置" aria-label="服务商设置">
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
