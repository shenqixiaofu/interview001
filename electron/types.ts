export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status?: "streaming" | "complete" | "error";
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  sessionId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  projectPath: string;
}

export interface PersistedState {
  conversations: Conversation[];
  settings: AppSettings;
}

export interface BootstrapData extends PersistedState {
  claudeAvailable: boolean;
  claudeVersion: string;
}

export interface StreamChunk {
  conversationId: string;
  messageId: string;
  text: string;
}

export interface StreamDone {
  conversation: Conversation;
}

export interface StreamError {
  conversationId: string;
  messageId: string;
  message: string;
}

export interface DesktopApi {
  getBootstrap: () => Promise<BootstrapData>;
  createConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<PersistedState>;
  updateConversationModel: (id: string, model: string) => Promise<Conversation>;
  chooseProject: () => Promise<AppSettings>;
  sendMessage: (conversationId: string, prompt: string) => Promise<Conversation>;
  stopGeneration: (conversationId: string) => Promise<void>;
  onChunk: (callback: (payload: StreamChunk) => void) => () => void;
  onDone: (callback: (payload: StreamDone) => void) => () => void;
  onError: (callback: (payload: StreamError) => void) => () => void;
}
