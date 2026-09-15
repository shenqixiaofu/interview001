import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ComposerProps {
  disabled: boolean;
  running: boolean;
  onSend: (prompt: string) => Promise<void>;
  onStop: () => void;
}

export function Composer({ disabled, running, onSend, onStop }: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [disabled]);

  const submit = async (): Promise<void> => {
    if (!prompt.trim() || disabled || running) return;
    const content = prompt;
    setPrompt("");
    await onSend(content);
  };

  return (
    <footer className="composer-wrap">
      <div className={`composer ${running ? "composer--running" : ""}`}>
        <label className="sr-only" htmlFor="chat-input">发送消息</label>
        <textarea
          id="chat-input"
          ref={textareaRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={disabled ? "Claude Code 尚未就绪" : "发送消息…"}
          rows={1}
          disabled={disabled}
        />
        {running ? (
          <button className="send-button send-button--stop" onClick={onStop} title="停止生成" aria-label="停止生成">
            <Square size={15} fill="currentColor" />
          </button>
        ) : (
          <button
            className="send-button"
            onClick={() => void submit()}
            disabled={disabled || !prompt.trim()}
            title="发送"
            aria-label="发送"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
      <span className="composer-note">Claude 可能会出错，请检查重要内容。</span>
    </footer>
  );
}
