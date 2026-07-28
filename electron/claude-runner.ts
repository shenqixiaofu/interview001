import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

interface RunOptions {
  conversationId: string;
  prompt: string;
  model: string;
  cwd: string;
  baseUrl: string;
  apiKey: string;
  sessionId?: string;
  onText: (text: string) => void;
  onSession: (sessionId: string) => void;
}

export class ClaudeRunner {
  // stdin 被显式禁用，因此这里只保留终止进程所需的通用 ChildProcess 类型。
  private readonly processes = new Map<string, ChildProcess>();
  private readonly logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

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
    const debugFilePath = await this.createDebugFilePath(options.conversationId);
    const childEnv = {
      ...process.env,
      NO_COLOR: "1",
      ANTHROPIC_BASE_URL: options.baseUrl,
      ANTHROPIC_API_KEY: options.apiKey
    };
    // 用户级 ~/.claude/settings.json 里已存在中转配置，这里显式剥离旧 token，避免继续污染当前会话。
    delete childEnv.ANTHROPIC_AUTH_TOKEN;
    const args = [
      "--bare",
      "--setting-sources",
      "project,local",
      "--debug-file",
      debugFilePath,
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
      // 只使用当前会话注入的环境变量，避免 user settings 与本次服务商配置互相覆盖。
      env: childEnv,
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

      // 统一包裹输出解析，避免 JSON 解析异常被直接吞掉。
      const parseOutputLine = (line: string): void => {
        try {
          this.parseLine(line, options);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          finish(new Error(`Claude 输出解析失败\n日志文件：${debugFilePath}\n${reason}\n原始输出：${line.slice(0, 400)}`));
          child.kill("SIGTERM");
        }
      };

      child.stdout.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString("utf8");
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) parseOutputLine(line);
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      child.once("error", (error) => {
        finish(new Error(`启动 Claude Code 失败\n日志文件：${debugFilePath}\n${error.message}`));
      });
      child.once("close", (code, signal) => {
        if (stdoutBuffer.trim()) parseOutputLine(stdoutBuffer);
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          finish(new Error("生成已停止"));
          return;
        }
        if (code !== 0) {
          // 保留 Claude CLI 原始 stderr，方便直接定位鉴权或网关协议问题。
          const detail = stderr.trim();
          const summary = `Claude Code 退出，状态码 ${code}\n日志文件：${debugFilePath}`;
          finish(new Error(detail ? `${summary}\n${detail}` : summary));
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

  private async createDebugFilePath(conversationId: string): Promise<string> {
    // 每次请求写入独立日志文件，避免并发会话互相覆盖。
    await mkdir(this.logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(this.logDir, `${timestamp}-${conversationId}.log`);
  }
}
