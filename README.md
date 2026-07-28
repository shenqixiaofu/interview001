# Claude Code Desktop

Claude Code Desktop 是一个将本机 `claude` 命令行封装为图形聊天界面的 Electron 应用。它保留 Claude Code 的会话能力，同时提供服务商配置、模型切换、历史会话管理、工作目录选择和流式响应。

## 功能

- 在桌面 GUI 中与 Claude Code 对话
- 配置服务商 Base URL、API Key 和模型列表
- 在当前服务商提供的模型之间切换
- 新建、切换和删除本地历史会话
- 使用 Claude Code `session_id` 延续多轮上下文
- 实时展示流式回复，并可停止当前生成
- 选择 Claude Code 执行时使用的项目目录
- 渲染 Markdown、代码块、列表和引用

## 环境要求

- Node.js 20 或更高版本
- pnpm 10 或更高版本
- 已安装的 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

先确认 Claude Code 已安装：

```bash
claude --version
```

## 本地运行

```bash
pnpm install
pnpm dev
```

开发模式会同时启动 Vite、Electron 主进程 TypeScript 监听和桌面窗口。

## 类型检查与打包

```bash
pnpm typecheck
pnpm build
```

打包产物由 `electron-builder` 生成。支持 macOS DMG、Windows NSIS 和 Linux AppImage。

## 使用流程

1. 启动应用，确认左上方显示 Claude Code 版本。
2. 打开服务商设置，填写 Base URL、API Key，并拉取或维护模型列表。
3. 点击顶部文件夹按钮，选择要操作的代码项目。
4. 从顶部模型菜单选择模型。
5. 输入消息并发送；首次响应后会保存 Claude Code `session_id`。
6. 在左侧新建或切换会话，历史消息会自动保存在本机。

## 数据与安全

- 服务商 API Key 由主进程使用 Electron `safeStorage` 加密后保存在 `userData/providers.json`。
- 会话数据保存在 `userData/state.json`。
- Claude Code 调试日志保存在 `userData/claude-debug/`。
- 渲染进程未开启 Node.js 集成，只能调用 preload 中定义的白名单 IPC。
- Claude Code 子进程仅在用户发送消息时启动，工作目录由用户明确选择。
- 子进程以 `--bare --setting-sources project,local` 方式启动，并显式注入当前服务商环境，避免被用户级 Claude 配置污染。

## 项目文档

- [架构与设计说明](./DESIGN.md)
- [AI 使用说明](./AI_USAGE.md)
- [演示录屏指引](./DEMO.md)
