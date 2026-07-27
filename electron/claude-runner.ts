import { spawn, type ChildProcess } from "node:child_process";

interface RunOptions {
  conversationId: string;
  prompt: string;
  model: string;
  cwd: string;
  sessionId?: string;
  onText: (text: string) => void;
  onSession: (sessionId: string) => void;
}

export class ClaudeRunner {
  // stdin 被显式禁用，因此这里只保留终止进程所需的通用 ChildProcess 类型。
  private readonly processes = new Map<string, ChildProcess>();

  async getVersion(): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn("claude", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
      let output = "";
      child.stdout.on("data", (data: Buffer) => {
        output += data.toString("utf8");
      });
      child.once("error", () => resolve(""));
      child.once("close", (code) => resolve(code === 0 ? output.trim() : ""));
    });
  }

  isRunning(conversationId: string): boolean {
    return this.processes.has(conversationId);
  }

  // 每次发送对应一个 Claude 子进程，session_id 用于下一轮恢复上下文。
  async run(options: RunOptions): Promise<void> {
    const args = [
      "--print",
      options.prompt,
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
      "--model",
      options.model
    ];
    if (options.sessionId) args.push("--resume", options.sessionId);

    const child = spawn("claude", args, {
      cwd: options.cwd,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.processes.set(options.conversationId, child);

    return new Promise((resolve, reject) => {
      let stdoutBuffer = "";
      let stderr = "";
      let completed = false;

      const finish = (error?: Error): void => {
        if (completed) return;
        completed = true;
        this.processes.delete(options.conversationId);
        error ? reject(error) : resolve();
      };

      child.stdout.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString("utf8");
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) this.parseLine(line, options);
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      child.once("error", (error) => finish(error));
      child.once("close", (code, signal) => {
        if (stdoutBuffer.trim()) this.parseLine(stdoutBuffer, options);
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          finish(new Error("生成已停止"));
          return;
        }
        if (code !== 0) {
          finish(new Error(stderr.trim() || `Claude Code 退出，状态码 ${code}`));
          return;
        }
        finish();
      });
    });
  }

  stop(conversationId: string): void {
    const child = this.processes.get(conversationId);
    if (!child) return;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 1500);
  }

  private parseLine(line: string, options: RunOptions): void {
    if (!line.trim()) return;
    const payload = JSON.parse(line) as Record<string, unknown>;

    if (typeof payload.session_id === "string") {
      options.onSession(payload.session_id);
    }

    // partial message 的文本位于 Anthropic 流事件 delta 中。
    if (payload.type === "stream_event") {
      const event = payload.event as { type?: string; delta?: { type?: string; text?: string } };
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        options.onText(event.delta.text);
      }
    }
  }
}
