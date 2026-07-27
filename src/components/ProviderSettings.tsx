import { Check, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProviderConfig, ProviderInput, ProviderState } from "../../electron/types";

interface ProviderSettingsProps extends ProviderState {
  onClose: () => void;
  onChange: (state: ProviderState) => void;
  onNotice: (message: string) => void;
}

interface Draft {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

const emptyDraft = (): Draft => ({ name: "", baseUrl: "", apiKey: "", models: [] });

export function ProviderSettings(props: ProviderSettingsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(props.activeProviderId);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [modelInput, setModelInput] = useState("");
  const [busy, setBusy] = useState(false);

  const loadProvider = (provider?: ProviderConfig): void => {
    setDraft(provider ? { ...provider, apiKey: "" } : emptyDraft());
    setModelInput("");
  };

  useEffect(() => {
    loadProvider(props.providers.find((provider) => provider.id === selectedId));
  }, [selectedId]);

  const asInput = (): ProviderInput => ({
    id: draft.id,
    name: draft.name,
    baseUrl: draft.baseUrl,
    apiKey: draft.apiKey || undefined,
    models: draft.models
  });

  const addModel = (model: string): void => {
    const value = model.trim();
    if (!value || draft.models.includes(value)) return;
    setDraft((current) => ({ ...current, models: [...current.models, value] }));
    setModelInput("");
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const state = await window.desktopApi.saveProvider(asInput());
      props.onChange(state);
      const saved = state.providers.find((provider) =>
        provider.id === draft.id || (!draft.id && provider.name === draft.name.trim())
      );
      if (saved) {
        setSelectedId(saved.id);
        loadProvider(saved);
      }
      props.onNotice("服务商配置已保存");
    } catch (error) {
      props.onNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const queryModels = async (): Promise<void> => {
    setBusy(true);
    try {
      const models = await window.desktopApi.queryProviderModels(asInput());
      setDraft((current) => ({ ...current, models }));
      props.onNotice(`已查询到 ${models.length} 个模型`);
    } catch (error) {
      props.onNotice(error instanceof Error ? error.message : "查询失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!draft.id || !window.confirm("确定删除这个服务商配置吗？")) return;
    const state = await window.desktopApi.deleteProvider(draft.id);
    props.onChange(state);
    setSelectedId(state.activeProviderId);
    loadProvider(state.providers.find((provider) => provider.id === state.activeProviderId));
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div><h2 id="settings-title">服务商设置</h2><span>配置 Claude Code 使用的 API 中转与模型</span></div>
          <button className="icon-button" onClick={props.onClose} title="关闭" aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="settings-layout">
          <aside className="provider-nav">
            <button className="provider-add" onClick={() => { setSelectedId(null); loadProvider(); }}><Plus size={15} />添加服务商</button>
            {props.providers.map((provider) => (
              <button
                className={provider.id === selectedId ? "provider-nav-item provider-nav-item--active" : "provider-nav-item"}
                key={provider.id}
                onClick={() => setSelectedId(provider.id)}
              >
                <span>{provider.name}</span>
                {provider.id === props.activeProviderId && <Check size={14} />}
              </button>
            ))}
          </aside>
          <div className="provider-form">
            <label><span>名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：公司中转" /></label>
            <label><span>Base URL</span><input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.example.com" /></label>
            <label><span>API Key</span><input type="password" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder={draft.id ? "已安全保存，留空则不修改" : "输入 API Key"} /></label>
            <div className="model-editor">
              <div className="model-editor-heading"><span>模型</span><button onClick={() => void queryModels()} disabled={busy}><RefreshCw size={14} />查询模型</button></div>
              <div className="model-add-row">
                <input value={modelInput} onChange={(event) => setModelInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addModel(modelInput)} placeholder="输入模型 ID" />
                <button className="icon-button" onClick={() => addModel(modelInput)} title="添加模型" aria-label="添加模型"><Plus size={16} /></button>
              </div>
              <div className="model-list">
                {draft.models.length === 0 && <span className="model-empty">尚未添加模型</span>}
                {draft.models.map((model) => (
                  <div className="model-row" key={model}><code>{model}</code><button onClick={() => setDraft({ ...draft, models: draft.models.filter((item) => item !== model) })} title="删除模型" aria-label={`删除 ${model}`}><X size={14} /></button></div>
                ))}
              </div>
            </div>
            <footer className="settings-actions">
              {draft.id && <button className="danger-button" onClick={() => void remove()}><Trash2 size={15} />删除</button>}
              <button className="primary-button" onClick={() => void save()} disabled={busy}><Check size={15} />保存配置</button>
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
