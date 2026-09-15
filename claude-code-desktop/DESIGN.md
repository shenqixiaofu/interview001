# 架构与设计说明

本文对应交付要求中的“3. 设计说明”，重点说明架构设计、技术选型、文件结构，以及本次实现中主动放弃了什么、为什么放弃。

## 1. 目标与范围

本项目只做一个最小但完整的桌面闭环：

- 能在桌面 GUI 中直接与 Claude Code 对话。
- 能切换服务商和模型。
- 能持久化多个本地会话，并继续之前的上下文。

题目没有要求做完整 IDE、权限审批面板、插件市场或复杂设置中心，所以实现刻意控制范围，优先保证“能用、能切、能存、能排障”。

## 2. 技术选型

### Electron

Claude Code 的核心能力来自本机 `claude` CLI，而不是 HTTP SDK。桌面端必须能启动子进程、读取 stdout/stderr、选择工作目录、落盘本地状态。Electron 主进程天然适合处理这些系统能力，避免额外命令桥或跨语言协议。

不选 Tauri 的原因很直接：本题重点不是做壳，而是稳定封装 Node CLI。Electron 直接使用 `child_process` 和 `dialog`，路径最短，风险最低。

### React + TypeScript + Vite

渲染层有三类高频状态：会话切换、流式文本追加、生成中断/失败。React 处理这些状态更新成本低；TypeScript 让主进程、preload、渲染进程共享统一类型；Vite 提供足够轻量的本地开发链路。

### JSON 持久化

当前状态只有三类：

- 会话与消息
- 项目路径
- 服务商配置

它们都不需要复杂查询，也没有多用户并发写入，直接存 `userData/state.json` 和 `userData/providers.json` 即可。此时引入 SQLite 只会增加打包成本和排障面。

## 3. 运行时架构

```text
React Renderer
  │  window.desktopApi
  ▼
Preload 白名单桥接
  │  IPC
  ▼
Electron Main
  ├─ ConversationStore ── state.json
  ├─ ProviderStore ────── providers.json
  ├─ Folder Dialog
  └─ ClaudeRunner ─────── claude CLI 子进程
                          ├─ stdout: stream-json
                          ├─ stderr: 原始错误透传
                          └─ debug-file: userData/claude-debug/*.log
```

这套结构的原则只有两个：

- 渲染进程只做界面与状态编排，不直接接触 Node 能力。
- 所有 Claude Code 调用、认证注入、日志记录都集中在主进程处理，避免逻辑分散。

## 4. 核心数据设计

### 会话状态

`Conversation` 保存标题、模型、`sessionId`、消息列表和时间戳。首条用户消息自动生成标题。消息状态分为 `streaming`、`complete`、`error`，便于界面正确表达生命周期。

### 服务商状态

服务商配置单独保存在 `providers.json`，与普通会话数据拆开。API Key 使用 Electron `safeStorage` 加密后再写盘，渲染层只拿到脱敏后的 `hasApiKey` 状态，不会直接读到明文。

### 流式写盘策略

流式阶段只更新内存，不逐 token 写文件。只有在生成完成、失败或停止后，才一次性把最终消息写回存储。这样能减少频繁 IO，也避免半截内容把状态文件打碎。

## 5. Claude Code 调用链路

每次发送消息，主进程都会先做三件事：

1. 校验当前会话存在且未处于生成中。
2. 校验已选择服务商，并且当前模型确实存在于该服务商模型列表中。
3. 先把用户消息和一个 `streaming` 状态的 assistant 占位消息写入会话。

随后通过 `ClaudeRunner` 启动 `claude` 子进程，关键参数如下：

```text
claude --bare
       --setting-sources project,local
       --debug-file <userData/claude-debug/...log>
       --print <prompt>
       --output-format stream-json
       --include-partial-messages
       --verbose
       --model <model>
       [--resume <session_id>]
```

同时显式注入当前服务商的运行环境：

```text
ANTHROPIC_BASE_URL=<provider.baseUrl>
ANTHROPIC_API_KEY=<provider.apiKey>
```

并主动删除继承环境里的 `ANTHROPIC_AUTH_TOKEN`，避免被本机用户级 Claude 配置污染。

这样设计有两个直接收益：

- 子进程认证来源只和当前服务商绑定，不依赖用户终端里残留的登录态。
- 当本机 `~/.claude/settings.json` 已经写死别的中转配置时，桌面应用仍能隔离出自己的独立会话。

## 6. 流式解析与错误处理

`claude` stdout 使用 `stream-json` 协议。主进程按行解析：

- 读到 `session_id` 时保存，用于下一轮 `--resume`。
- 读到 `stream_event/content_block_delta/text_delta` 时，把增量文本推给渲染层。
- 读到非零退出码时，把 stderr 和调试日志路径一起回传到界面。

这部分后期专门补了一层诊断增强：

- 每次请求生成单独的 `debug-file`。
- 解析失败时把原始输出前 400 字一起写进错误文案。
- 界面错误消息里直接附日志路径，便于定位。

这个设计来自一次真实排障经验：如果只显示“Claude Code 退出，状态码 1”，几乎没有继续定位的价值。

## 7. 模型与服务商的一致性处理

项目早期存在一个真实问题：服务商模型列表和会话默认模型别名不一致时，UI 看起来能发，实际会把错误模型传给 Claude Code。

为了解决这个问题，最终做了两层保护：

- 渲染层在发现当前会话模型不属于当前服务商时，自动切换到首个可用模型。
- 主进程在真正发送前再做一次硬校验，不允许无效模型进入 ClaudeRunner。

这样即使前端状态错位，也不会把错误模型真正发出去。

## 8. 安全与隔离策略

本项目没有把界面做成“完全替代 Claude Code 的权限系统”，而是有意识地收敛边界：

- 不向 CLI 注入危险的跳过权限参数。
- 渲染层不开启 Node.js 集成，只通过 preload 暴露白名单 API。
- 项目目录必须由用户显式选择，主进程不擅自扩大工作范围。
- 服务商 Key 只留在主进程读取和解密，渲染层不接触明文。

## 9. 主动放弃的内容

- 未实现工具调用审批 UI：这会把题目从“聊天封装”升级成“完整 IDE 前端”，投入和收益不匹配。
- 未实现会话搜索、重命名、标签分类：对当前题目不是必要能力。
- 未引入数据库、状态管理框架、UI 组件库：当前规模下只会增加复杂度。
- 未兼容旧版本 Claude Code 输出协议：实现只面向当前 `stream-json` 能力。
- 未接入自动更新、崩溃上报、远程日志平台：本题优先本地可运行和可排障。

## 10. 文件结构

```text
electron/
  main.ts             Electron 生命周期、IPC、发送前校验
  preload.ts          白名单桥接
  claude-runner.ts    Claude CLI 启动、流解析、调试日志
  store.ts            会话与项目目录持久化
  provider-store.ts   服务商与加密 API Key 持久化
  types.ts            跨进程共享类型
src/
  App.tsx             渲染层状态编排与事件订阅
  components/         顶栏、会话栏、消息区、输入区、设置弹窗
  styles.css          桌面 UI 样式与响应式布局
```
