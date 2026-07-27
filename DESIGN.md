# 架构与设计说明

## 1. 目标

本项目聚焦一个最小但完整的桌面闭环：用户可以选择代码目录，在 GUI 中向 Claude Code 发送消息，看到流式回复，切换模型，并在多个持久化会话之间切换。

## 2. 技术选型

### Electron

Claude Code 是本机命令行程序，桌面应用需要创建和终止子进程、读取 stdout、选择文件夹并保存本地状态。Electron 的 Node.js 主进程可以直接完成这些工作，React 渲染进程则负责界面，两者通过 IPC 隔离。

未选择 Tauri，是因为本题的核心是 Node CLI 封装。Electron 可以直接使用 `child_process`，减少 Rust 侧命令桥接和跨语言数据协议。

### React + TypeScript + Vite

React 适合处理会话选择、流式消息、生成状态等界面状态；TypeScript 让主进程、preload 和渲染进程共享明确的数据协议；Vite 提供较轻的开发启动链路。

### JSON 持久化

当前数据只有设置、会话和消息，没有复杂查询与并发写入。单个 JSON 文件已满足需求，引入 SQLite 会增加打包体积和原生模块成本。

## 3. 进程架构

```text
React Renderer
  │  window.desktopApi
  ▼
Preload 白名单桥接
  │  Electron IPC
  ▼
Electron Main
  ├─ ConversationStore ── userData/state.json
  ├─ Folder Dialog
  └─ ClaudeRunner ── claude CLI 子进程
                       ├─ stdout: stream-json
                       └─ session_id: 下一轮 --resume
```

渲染进程不接触 Node.js API。`preload.ts` 只暴露本题所需的方法和三类流事件：增量文本、生成完成、生成失败。

## 4. Claude Code 调用

每次用户发送消息时，主进程执行：

```text
claude --print <prompt>
       --output-format stream-json
       --include-partial-messages
       --verbose
       --model <model>
       [--resume <session_id>]
```

`ClaudeRunner` 按行解析 JSON：

- `session_id` 保存到当前会话，用于后续 `--resume`。
- `stream_event/content_block_delta/text_delta` 转成界面增量文本。
- 非零退出码和 stderr 转成可见错误状态。
- 停止生成时向对应子进程发送 `SIGTERM`。

应用没有加入自动批准权限或跳过权限检查的参数。当前 GUI 定位为对话封装，不擅自扩大 Claude Code 的系统权限。

## 5. 状态与数据结构

`Conversation` 保存标题、模型、Claude session ID、消息和时间。首条用户消息自动成为会话标题。消息状态分为 `streaming`、`complete` 和 `error`，便于界面准确反馈生命周期。

写入发生在以下节点：

- 新建、删除会话
- 切换模型或项目目录
- 用户消息进入队列
- Claude 回复完成或失败

流式增量只保存在渲染进程内存中，结束时一次性写盘，避免逐 token 写文件。

## 6. 界面设计

界面定位为安静、紧凑的开发工具，而不是营销页面：

- 左侧固定会话导航，主区域用于消息阅读和输入。
- 顶部展示 CLI 状态、项目目录和模型，降低上下文切换成本。
- 深灰中性色承载信息；绿色表示可运行状态，珊瑚色区分用户与错误。
- Assistant 消息不使用卡片嵌套，代码块才使用明确边界。
- 所有图标来自 Lucide；交互元素具有 hover、focus 和 disabled 状态。
- 窄窗口将侧栏变为抽屉，并支持 `prefers-reduced-motion`。

## 7. 主动放弃的内容

- 未内置 API Key 登录：认证由 Claude Code 官方 CLI 管理，避免重复保存凭证。
- 未实现工具调用审批 UI：这需要解析权限请求并建立独立协议，超出基础聊天闭环。
- 未实现全文搜索和会话重命名：不影响题目要求的多会话切换。
- 未引入数据库、状态管理框架和 UI 组件库：当前规模下会增加不必要复杂度。
- 未加入旧版本 Claude Code 输出兼容解析：项目直接面向当前 `stream-json` 协议。

## 8. 文件结构

```text
electron/
  main.ts             Electron 生命周期与 IPC
  preload.ts          安全白名单桥接
  claude-runner.ts    Claude Code 子进程与流解析
  store.ts            JSON 会话持久化
  types.ts            跨进程数据协议
src/
  components/         会话栏、顶部栏、消息区、输入区
  App.tsx             渲染进程状态编排
  styles.css          完整视觉与响应式样式
```
