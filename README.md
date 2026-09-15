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

## AI Agent 项目上下文

本节是给 AI Agent 阅读的项目上下文补充。Agent 处理本项目任务时，应该先了解项目事实、目录职责和已有文档，再进行分析或修改。

### 上下文层级

本项目中的不同信息承担不同职责：

- 会话注入上下文：由运行环境注入，负责角色、权限、协作方式和当前任务要求，优先级高于项目文档。
- 根目录 `README.md`：负责说明项目定位、运行方式、核心目录和关键事实，是 Agent 进入项目后的第一层项目上下文。
- `AGENTS.md`：如果项目后续增加该文件，用于补充仓库级行为约束、代码规范和验证规则。
- `Skills`：用于沉淀某类任务的可复用工作流，例如 README 编写、文档整理、图片处理或代码审查。
- `DESIGN.md`：负责说明架构、技术选型、数据设计、调用链和主动放弃的范围。
- `AI_USAGE.md`：记录 AI 在本项目中的实际使用方式、排障过程和已经修正的问题。

如果会话注入上下文与项目文档存在冲突，应遵循更高优先级的会话要求；如果项目文档与当前代码行为不一致，应以当前代码、配置和实际运行结果为准，并同步指出文档漂移。

### 项目定位

这是一个使用 Electron 封装本机 `claude` CLI 的桌面聊天应用，不是独立实现的大模型客户端。项目重点是把 Claude Code 的会话能力包装成桌面界面，并补充服务商配置、模型切换、历史会话、工作目录选择、流式响应和错误诊断能力。

处理任务时要区分两层：

- 当前桌面应用本身：负责界面、会话状态、服务商配置、IPC 和 Claude CLI 子进程管理。
- 被调用的 Claude Code CLI：作为运行时依赖，在用户选定的项目目录中执行任务。

### 核心目录和文件

```text
electron/
  main.ts             Electron 生命周期、IPC、发送前校验
  preload.ts          渲染层与主进程之间的白名单桥接
  claude-runner.ts    Claude CLI 启动、流式输出解析和调试日志
  store.ts            会话与项目目录持久化
  provider-store.ts   服务商配置与加密 API Key 持久化
  types.ts            主进程、preload 和渲染层共享类型

src/
  App.tsx             渲染层状态编排
  components/         顶栏、会话栏、消息区、输入区和设置界面
  main.tsx            React 渲染入口
  styles.css          应用样式与响应式布局

package.json          依赖和开发、检查、构建脚本
DESIGN.md             架构与设计说明
AI_USAGE.md           AI 使用说明和真实排障记录
DEMO.md               演示录屏指引
```

### 关键运行链路

```text
React Renderer
  -> window.desktopApi
  -> preload 白名单桥接
  -> IPC
  -> Electron Main
  -> ClaudeRunner
  -> claude CLI
```

主进程负责处理文件系统、目录选择、服务商密钥、会话持久化和子进程调用；渲染进程主要负责页面展示、用户交互和状态编排。不要让渲染进程直接接触 Node.js 能力或明文服务商密钥。

### 主要状态和数据边界

- 会话数据保存在 Electron `userData/state.json`。
- 服务商配置保存在 Electron `userData/providers.json`。
- API Key 由主进程通过 Electron `safeStorage` 加密后保存。
- 渲染层只需要获得脱敏后的服务商状态，不应直接读取明文 API Key。
- Claude 调试日志保存在 `userData/claude-debug/`。
- 流式生成阶段先更新内存状态，完成、失败或停止后再持久化最终消息。

### Agent 处理任务的建议流程

1. 先读取本 README、`package.json` 和与任务相关的源码。
2. 根据任务需要继续读取 `DESIGN.md`、`AI_USAGE.md` 或 `DEMO.md`。
3. 查看当前 Git 状态，理解已有修改，不覆盖与当前任务无关的变更。
4. 先说明对需求、影响文件和实现方案的理解，再进行文件修改。
5. 保持修改范围最小，优先沿用现有类型、IPC、Store 和组件模式。
6. 修改后检查实际 diff、导入关系、类型和语法。
7. 除非任务明确允许，不主动执行构建或完整测试；需要验证时优先使用与改动匹配的轻量检查。
8. 如果发现文档、代码和运行行为不一致，应以证据为基础说明差异，不凭空补写结论。

### Agent 能力与会话命令的区别

Agent 的工具是运行环境提供的执行能力，常见类别包括文件读取、文件搜索、Shell 命令、结构化 Patch、Web 查询、浏览器操作、MCP 外部服务和子 Agent。具体可用工具取决于当前运行环境。

`/model`、`/compact`、`/clear` 这类命令属于会话控制：

- `/model`：切换当前会话使用的模型。
- `/compact`：压缩已有上下文，保留任务摘要。
- `/clear`：清空当前会话上下文或重新开始会话。

它们不是文件读取、命令执行或代码修改工具，面试回答时应该把“会话命令”和“Agent 工具”分开说明。
