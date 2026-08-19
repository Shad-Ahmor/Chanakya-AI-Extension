import { useState } from 'react';
import { ModelCapability, ModelConfig, ModelExecutionMode, ModelProvider, ModelRole } from '../../types/config';
import { X, Plus, Trash2, Cpu, Globe, Server, Check } from 'lucide-react';

interface Props {
  model: ModelConfig | null;
  onSave: (model: ModelConfig) => void;
  onClose: () => void;
}

export default function ModelEditModal({ model, onSave, onClose }: Props) {
  const [name, setName] = useState(model?.name || '');
  const [provider, setProvider] = useState<ModelProvider>(model?.provider || 'openai');
  const [modelString, setModelString] = useState(model?.model || '');
  const [baseUrlInput, setBaseUrlInput] = useState(() => {
    const init = model?.apiBase || 'https://api.openai.com/v1';
    let protocolMatch = init.match(/^(https?:\/\/)(.*)$/);
    if (protocolMatch) {
       const protocol = protocolMatch[1];
       const rest = protocolMatch[2];
       const firstSlashIdx = rest.indexOf('/');
       if (firstSlashIdx !== -1) return protocol + rest.substring(0, firstSlashIdx);
    } else {
       const firstSlashIdx = init.indexOf('/');
       if (firstSlashIdx !== -1) return init.substring(0, firstSlashIdx);
    }
    return init;
  });

  const [endpointInput, setEndpointInput] = useState(() => {
    const init = model?.apiBase || 'https://api.openai.com/v1';
    let protocolMatch = init.match(/^(https?:\/\/)(.*)$/);
    if (protocolMatch) {
       const rest = protocolMatch[2];
       const firstSlashIdx = rest.indexOf('/');
       if (firstSlashIdx !== -1) return rest.substring(firstSlashIdx);
    } else {
       const firstSlashIdx = init.indexOf('/');
       if (firstSlashIdx !== -1) return init.substring(firstSlashIdx);
    }
    return '';
  });

  const updateApiBase = (fullUrl: string) => {
    let protocolMatch = fullUrl.match(/^(https?:\/\/)(.*)$/);
    if (protocolMatch) {
       const protocol = protocolMatch[1];
       const rest = protocolMatch[2];
       const firstSlashIdx = rest.indexOf('/');
       if (firstSlashIdx !== -1) {
          setBaseUrlInput(protocol + rest.substring(0, firstSlashIdx));
          setEndpointInput(rest.substring(firstSlashIdx));
       } else {
          setBaseUrlInput(fullUrl);
          setEndpointInput('');
       }
    } else {
       const firstSlashIdx = fullUrl.indexOf('/');
       if (firstSlashIdx !== -1) {
          setBaseUrlInput(fullUrl.substring(0, firstSlashIdx));
          setEndpointInput(fullUrl.substring(firstSlashIdx));
       } else {
          setBaseUrlInput(fullUrl);
          setEndpointInput('');
       }
    }
  };
  const [apiKey, setApiKey] = useState(model?.apiKey || '');
  const [executionMode, setExecutionMode] = useState<ModelExecutionMode>(
    model?.executionMode || (model?.isLocal ? 'local' : model?.requestOptions?.headers ? 'enterprise_foundry' : 'online_api')
  );
  const [roles, setRoles] = useState<ModelRole[]>(model?.roles || ['chat', 'edit', 'apply']);
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(model?.capabilities || []);
  const [contextLength, setContextLength] = useState(model?.defaultCompletionOptions?.contextLength || 1047576);
  const [maxTokens, setMaxTokens] = useState(model?.defaultCompletionOptions?.maxTokens || 32768);
  const [useLegacyCompletionsEndpoint, _setUseLegacyCompletionsEndpoint] = useState(model?.useLegacyCompletionsEndpoint ?? false);
  // Provider group state for Quick Setup cascading dropdown
  const [selectedProviderGroup, setSelectedProviderGroup] = useState<string>('');
  
  // Custom headers state (e.g. tenant-id for RIL AI Foundry)
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(() => {
    if (model?.requestOptions?.headers) {
      return Object.entries(model.requestOptions.headers)
        .filter(([k]) => k !== 'workspace-id' && k !== 'deployment-id')
        .map(([k, v]) => ({ key: k, value: v }));
    }
    return [];
  });

  const [workspaceId, setWorkspaceId] = useState(model?.requestOptions?.headers?.['workspace-id'] || '');
  const [deploymentId, setDeploymentId] = useState(model?.requestOptions?.headers?.['deployment-id'] || '');

  const applyPreset = (presetType: string) => {
    setWorkspaceId('');
    setDeploymentId('');
    // ── Cloud: OpenAI ────────────────────────────────────────────────
    if (presetType === 'gpt41') {
      setName('OpenAI GPT-4.1'); setProvider('openai');
      setModelString('gpt-4.1-2025-04-14'); updateApiBase('https://api.openai.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['image_input', 'tools']);
      setContextLength(1047576); setMaxTokens(32768); setHeaders([]);
    } else if (presetType === 'gpt4o') {
      setName('OpenAI GPT-4o'); setProvider('openai');
      setModelString('gpt-4o'); updateApiBase('https://api.openai.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['image_input', 'tools']);
      setContextLength(128000); setMaxTokens(16384); setHeaders([]);
    } else if (presetType === 'gpt4o_mini') {
      setName('OpenAI GPT-4o Mini'); setProvider('openai');
      setModelString('gpt-4o-mini'); updateApiBase('https://api.openai.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools']);
      setContextLength(128000); setMaxTokens(16384); setHeaders([]);
    } else if (presetType === 'o3') {
      setName('OpenAI o3'); setProvider('openai');
      setModelString('o3'); updateApiBase('https://api.openai.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat']); setCapabilities(['image_input']);
      setContextLength(200000); setMaxTokens(100000); setHeaders([]);
    } else if (presetType === 'o4_mini') {
      setName('OpenAI o4-mini'); setProvider('openai');
      setModelString('o4-mini'); updateApiBase('https://api.openai.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit']); setCapabilities(['image_input', 'tools']);
      setContextLength(200000); setMaxTokens(100000); setHeaders([]);
    // ── Cloud: Anthropic Claude ──────────────────────────────────────
    } else if (presetType === 'claude_opus') {
      setName('Claude Opus 4.5'); setProvider('anthropic');
      setModelString('claude-opus-4-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['image_input', 'tools']);
      setContextLength(200000); setMaxTokens(32768); setHeaders([]);
    } else if (presetType === 'claude_sonnet') {
      setName('Claude Sonnet 4.5'); setProvider('anthropic');
      setModelString('claude-sonnet-4-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['image_input', 'tools']);
      setContextLength(200000); setMaxTokens(16384); setHeaders([]);
    } else if (presetType === 'claude_haiku') {
      setName('Claude Haiku 3.5'); setProvider('anthropic');
      setModelString('claude-haiku-3-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools']);
      setContextLength(200000); setMaxTokens(8192); setHeaders([]);

    } else if (presetType === 'anthropic_claude') {
      setName('Claude'); setProvider('anthropic');
      setModelString('claude'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude2') {
      setName('Claude 2'); setProvider('anthropic');
      setModelString('claude-2'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude21') {
      setName('Claude 2.1'); setProvider('anthropic');
      setModelString('claude-2.1'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude3haiku') {
      setName('Claude 3 Haiku'); setProvider('anthropic');
      setModelString('claude-3-haiku'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude3sonnet') {
      setName('Claude 3 Sonnet'); setProvider('anthropic');
      setModelString('claude-3-sonnet'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude3opus') {
      setName('Claude 3 Opus'); setProvider('anthropic');
      setModelString('claude-3-opus'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude35haiku') {
      setName('Claude 3.5 Haiku'); setProvider('anthropic');
      setModelString('claude-3.5-haiku'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude35sonnet') {
      setName('Claude 3.5 Sonnet'); setProvider('anthropic');
      setModelString('claude-3.5-sonnet'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude37sonnet') {
      setName('Claude 3.7 Sonnet'); setProvider('anthropic');
      setModelString('claude-3.7-sonnet'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude4haiku') {
      setName('Claude 4 Haiku'); setProvider('anthropic');
      setModelString('claude-4-haiku'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude4sonnet') {
      setName('Claude 4 Sonnet'); setProvider('anthropic');
      setModelString('claude-4-sonnet'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claude4opus') {
      setName('Claude 4 Opus'); setProvider('anthropic');
      setModelString('claude-4-opus'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudeopus41') {
      setName('Claude Opus 4.1'); setProvider('anthropic');
      setModelString('claude-opus-4.1'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudesonnet45') {
      setName('Claude Sonnet 4.5'); setProvider('anthropic');
      setModelString('claude-sonnet-4.5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudeopus45') {
      setName('Claude Opus 4.5'); setProvider('anthropic');
      setModelString('claude-opus-4.5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudehaiku45') {
      setName('Claude Haiku 4.5'); setProvider('anthropic');
      setModelString('claude-haiku-4.5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudesonnet46') {
      setName('Claude Sonnet 4.6'); setProvider('anthropic');
      setModelString('claude-sonnet-4.6'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudeopus46') {
      setName('Claude Opus 4.6'); setProvider('anthropic');
      setModelString('claude-opus-4.6'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudeopus47') {
      setName('Claude Opus 4.7'); setProvider('anthropic');
      setModelString('claude-opus-4.7'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudeopus48') {
      setName('Claude Opus 4.8'); setProvider('anthropic');
      setModelString('claude-opus-4.8'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudesonnet5') {
      setName('Claude Sonnet 5'); setProvider('anthropic');
      setModelString('claude-sonnet-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudefable5') {
      setName('Claude Fable 5'); setProvider('anthropic');
      setModelString('claude-fable-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudemythos5') {
      setName('Claude Mythos 5'); setProvider('anthropic');
      setModelString('claude-mythos-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'anthropic_claudeopus5') {
      setName('Claude Opus 5'); setProvider('anthropic');
      setModelString('claude-opus-5'); updateApiBase('https://api.anthropic.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    // ── Cloud: Google Gemini ─────────────────────────────────────────
    } else if (presetType === 'gemini_25_pro') {
      setName('Gemini 2.5 Pro'); setProvider('gemini');
      setModelString('gemini-2.5-pro'); updateApiBase('https://generativelanguage.googleapis.com/v1beta');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['image_input', 'tools']);
      setContextLength(1048576); setMaxTokens(65536); setHeaders([]);
    } else if (presetType === 'gemini_25_flash') {
      setName('Gemini 2.5 Flash'); setProvider('gemini');
      setModelString('gemini-2.5-flash'); updateApiBase('https://generativelanguage.googleapis.com/v1beta');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools']);
      setContextLength(1048576); setMaxTokens(32768); setHeaders([]);
    } else if (presetType === 'gemini_20_flash') {
      setName('Gemini 2.0 Flash'); setProvider('gemini');
      setModelString('gemini-2.0-flash'); updateApiBase('https://generativelanguage.googleapis.com/v1beta');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'autocomplete']); setCapabilities(['tools']);
      setContextLength(1048576); setMaxTokens(8192); setHeaders([]);
    // ── Cloud: Mistral ───────────────────────────────────────────────
    } else if (presetType === 'mistral_large') {
      setName('Mistral Large 2'); setProvider('mistral');
      setModelString('mistral-large-latest'); updateApiBase('https://api.mistral.ai/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['tools']);
      setContextLength(131072); setMaxTokens(32768); setHeaders([]);
    } else if (presetType === 'codestral') {
      setName('Codestral (Mistral)'); setProvider('mistral');
      setModelString('codestral-latest'); updateApiBase('https://codestral.mistral.ai/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'autocomplete']); setCapabilities(['fim']);
      setContextLength(256000); setMaxTokens(32768); setHeaders([]);
    // ── Cloud: DeepSeek ──────────────────────────────────────────────
    } else if (presetType === 'deepseek_v3') {
      setName('DeepSeek V3'); setProvider('deepseek');
      setModelString('deepseek-chat'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['tools']);
      setContextLength(64000); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_r1') {
      setName('DeepSeek R1'); setProvider('deepseek');
      setModelString('deepseek-reasoner'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat']); setCapabilities([]);
      setContextLength(64000); setMaxTokens(32768); setHeaders([]);

    } else if (presetType === 'deepseek_deepseekcoder13b') {
      setName('DeepSeek-Coder-1.3B'); setProvider('deepseek');
      setModelString('deepseek-coder-1.3b'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoder67b') {
      setName('DeepSeek-Coder-6.7B'); setProvider('deepseek');
      setModelString('deepseek-coder-6.7b'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoder33b') {
      setName('DeepSeek-Coder-33B'); setProvider('deepseek');
      setModelString('deepseek-coder-33b'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv1513b') {
      setName('DeepSeek-Coder-V1.5-1.3B'); setProvider('deepseek');
      setModelString('deepseek-coder-v1.5-1.3b'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv157b') {
      setName('DeepSeek-Coder-V1.5-7B'); setProvider('deepseek');
      setModelString('deepseek-coder-v1.5-7b'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv2litebase') {
      setName('DeepSeek-Coder-V2-Lite-Base'); setProvider('deepseek');
      setModelString('deepseek-coder-v2-lite-base'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv2liteinstruct') {
      setName('DeepSeek-Coder-V2-Lite-Instruct'); setProvider('deepseek');
      setModelString('deepseek-coder-v2-lite-instruct'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv2base') {
      setName('DeepSeek-Coder-V2-Base'); setProvider('deepseek');
      setModelString('deepseek-coder-v2-base'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv2instruct') {
      setName('DeepSeek-Coder-V2-Instruct'); setProvider('deepseek');
      setModelString('deepseek-coder-v2-instruct'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'deepseek_deepseekcoderv2instruct0724') {
      setName('DeepSeek-Coder-V2-Instruct-0724'); setProvider('deepseek');
      setModelString('deepseek-coder-v2-instruct-0724'); updateApiBase('https://api.deepseek.com/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    // ── Cloud: Groq ──────────────────────────────────────────────────
    } else if (presetType === 'groq_llama') {
      setName('Groq Llama 3.3 70B'); setProvider('meta');
      setModelString('llama-3.3-70b-versatile'); updateApiBase('https://api.groq.com/openai/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit']); setCapabilities(['tools']);
      setContextLength(128000); setMaxTokens(32768); setHeaders([]);
    // ── Local ────────────────────────────────────────────────────────
    } else if (presetType === 'ollama') {
      setName('Local Ollama (Qwen 2.5 Coder)'); setProvider('ollama');
      setModelString('qwen2.5-coder:7b'); updateApiBase('http://localhost:11434/v1');
      setApiKey(''); setExecutionMode('local');
      setRoles(['chat', 'edit', 'autocomplete']); setCapabilities(['fim']);
      setContextLength(32768); setMaxTokens(4096); setHeaders([]);
    } else if (presetType === 'lmstudio') {
      setName('Local LM Studio (Codestral)'); setProvider('lmstudio');
      setModelString('codestral-22b'); updateApiBase('http://localhost:1234/v1');
      setApiKey(''); setExecutionMode('local');
      setRoles(['chat', 'autocomplete']); setCapabilities(['fim']); setHeaders([]);
    // ── Cloud: Alibaba Qwen ──────────────────────────────────────────
} else if (presetType === 'qwen_codeqwen157b') {
      setName('CodeQwen1.5-7B'); setProvider('qwen');
      setModelString('codeqwen1.5-7b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_codeqwen157bchat') {
      setName('CodeQwen1.5-7B-Chat'); setProvider('qwen');
      setModelString('codeqwen1.5-7b-chat'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder05b') {
      setName('Qwen2.5-Coder-0.5B'); setProvider('qwen');
      setModelString('qwen2.5-coder-0.5b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder05binstruct') {
      setName('Qwen2.5-Coder-0.5B-Instruct'); setProvider('qwen');
      setModelString('qwen2.5-coder-0.5b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder15b') {
      setName('Qwen2.5-Coder-1.5B'); setProvider('qwen');
      setModelString('qwen2.5-coder-1.5b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder15binstruct') {
      setName('Qwen2.5-Coder-1.5B-Instruct'); setProvider('qwen');
      setModelString('qwen2.5-coder-1.5b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder3b') {
      setName('Qwen2.5-Coder-3B'); setProvider('qwen');
      setModelString('qwen2.5-coder-3b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder3binstruct') {
      setName('Qwen2.5-Coder-3B-Instruct'); setProvider('qwen');
      setModelString('qwen2.5-coder-3b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder7b') {
      setName('Qwen2.5-Coder-7B'); setProvider('qwen');
      setModelString('qwen2.5-coder-7b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder14b') {
      setName('Qwen2.5-Coder-14B'); setProvider('qwen');
      setModelString('qwen2.5-coder-14b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen25coder32b') {
      setName('Qwen2.5-Coder-32B'); setProvider('qwen');
      setModelString('qwen2.5-coder-32b'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen3coder30ba3binstruct') {
      setName('Qwen3-Coder-30B-A3B-Instruct'); setProvider('qwen');
      setModelString('qwen3-coder-30b-a3b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen3coder480ba35binstruct') {
      setName('Qwen3-Coder-480B-A35B-Instruct'); setProvider('qwen');
      setModelString('qwen3-coder-480b-a35b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen3coder480ba35binstructfp8') {
      setName('Qwen3-Coder-480B-A35B-Instruct-FP8'); setProvider('qwen');
      setModelString('qwen3-coder-480b-a35b-instruct-fp8'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen3codernext') {
      setName('Qwen3-Coder-Next'); setProvider('qwen');
      setModelString('qwen3-coder-next'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_qwen3codernextbase') {
      setName('Qwen3-Coder-Next-Base'); setProvider('qwen');
      setModelString('qwen3-coder-next-base'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen25_coder_32b') {
      setName('Qwen2.5 Coder 32B'); setProvider('qwen');
      setModelString('qwen2.5-coder-32b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen25_coder_14b') {
      setName('Qwen2.5 Coder 14B'); setProvider('qwen');
      setModelString('qwen2.5-coder-14b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen25_coder_7b') {
      setName('Qwen2.5 Coder 7B'); setProvider('qwen');
      setModelString('qwen2.5-coder-7b-instruct'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_coder_plus') {
      setName('Qwen Coder Plus'); setProvider('qwen');
      setModelString('qwen-coder-plus-latest'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['tools']);
      setContextLength(131072); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_coder_turbo') {
      setName('Qwen Coder Turbo'); setProvider('qwen');
      setModelString('qwen-coder-turbo-latest'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['tools']);
      setContextLength(131072); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_36_27b') {
      setName('Qwen 3.6 27B'); setProvider('qwen');
      setModelString('Qwen/Qwen3.6-27B'); updateApiBase('http://ip/inference/o7015c916-260512103754/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools', 'fim']);
      setContextLength(32768); setMaxTokens(4096);
      setHeaders([]);
      setWorkspaceId('d33a71f5-9520-4025-9606-d00e1dc6dc27');
    } else if (presetType === 'qwen_max') {
      setName('Qwen Max'); setProvider('qwen');
      setModelString('qwen-max'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['tools']);
      setContextLength(32000); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_plus') {
      setName('Qwen Plus'); setProvider('qwen');
      setModelString('qwen-plus'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply']); setCapabilities(['tools']);
      setContextLength(128000); setMaxTokens(8192); setHeaders([]);
    } else if (presetType === 'qwen_turbo') {
      setName('Qwen Turbo'); setProvider('qwen');
      setModelString('qwen-turbo'); updateApiBase('https://dashscope.aliyuncs.com/compatible-mode/v1');
      setApiKey(''); setExecutionMode('online_api');
      setRoles(['chat', 'edit', 'apply', 'autocomplete']); setCapabilities(['tools']);
      setContextLength(1000000); setMaxTokens(8192); setHeaders([]);
    }
  };

  const toggleRole = (role: ModelRole) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleCapability = (cap: ModelCapability) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !modelString.trim()) return;

    const headersMap: Record<string, string> = {};
    headers.forEach((h) => {
      if (h.key.trim() && h.value.trim()) {
        headersMap[h.key.trim()] = h.value.trim();
      }
    });

    if (workspaceId.trim()) headersMap['workspace-id'] = workspaceId.trim();
    if (deploymentId.trim()) headersMap['deployment-id'] = deploymentId.trim();

    const isLocal = executionMode === 'local';

    const savedModel: ModelConfig = {
      id: model?.id || `model-${Date.now()}`,
      name: name.trim(),
      provider,
      model: modelString.trim(),
      apiBase: ((baseUrlInput.trim() + endpointInput.trim()).replace(/(?<!:)\/\//g, '/')) || undefined,
      apiKey: apiKey.trim() || undefined,
      isLocal,
      executionMode,
      roles: roles.length > 0 ? roles : ['chat'],
      requestOptions: Object.keys(headersMap).length > 0 ? { headers: headersMap } : undefined,
      defaultCompletionOptions: {
        contextLength: Number(contextLength) || 1047576,
        maxTokens: Number(maxTokens) || 32768,
        temperature: 0.2
      },
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      useLegacyCompletionsEndpoint
    };

    onSave(savedModel);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-[var(--vscode-foreground)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)]">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--vscode-foreground)]">
            {executionMode === 'local' ? (
              <Cpu className="w-4 h-4 opacity-80" />
            ) : executionMode === 'enterprise_foundry' ? (
              <Server className="w-4 h-4 opacity-80" />
            ) : (
              <Globe className="w-4 h-4 opacity-80" />
            )}
            <span>{model ? `Configure: ${model.name}` : 'Add Model to Hub'}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition text-[var(--vscode-icon-foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Quick Preset: Provider → Model Dropdowns (cascading) */}
          <div className="p-3 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)]">
            <label className="block text-[11px] font-bold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider mb-3">
              ⚡ Quick Setup — Provider select karo, phir usi ka model choose karo!
            </label>
            <div className="flex gap-2 items-end">

              {/* Step 1: Provider */}
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-[var(--vscode-descriptionForeground)] mb-1">1. Provider</label>
                <select
                  id="provider-select"
                  value={selectedProviderGroup}
                  onChange={(e) => { setSelectedProviderGroup(e.target.value); }}
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] text-xs"
                >
                  <option value="">— Select Provider —</option>
                  <optgroup label="☁️ Cloud APIs">
                    <option value="anthropic">🟠 Anthropic (Claude)</option>
                    <option value="openai">🟢 OpenAI / Codex</option>
                    <option value="gemini">🔵 Google Gemini</option>
                    <option value="mistral">🟡 Mistral AI</option>
                    <option value="deepseek">🟣 DeepSeek</option>
                    <option value="groq">⚡ Groq (Llama)</option>
                    <option value="qwen">🔴 Alibaba (Qwen)</option>
                  </optgroup>
                  <optgroup label="🖥️ Local">
                    <option value="ollama">🏠 Ollama (Local)</option>
                    <option value="lmstudio">🏠 LM Studio (Local)</option>
                  </optgroup>
                </select>
              </div>

              {/* Step 2: Model — filtered by provider */}
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-[var(--vscode-descriptionForeground)] mb-1">2. Model</label>
                <select
                  id="model-preset-select"
                  value=""
                  disabled={!selectedProviderGroup}
                  onChange={(e) => { if (e.target.value) { applyPreset(e.target.value); } }}
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] text-xs disabled:opacity-50"
                >
                  <option value="">{selectedProviderGroup ? '— Select Model —' : '← Pehle provider select karo'}</option>

                  {selectedProviderGroup === 'anthropic' && (<>
                    <option value="claude_opus">Claude Opus 4.5 — Most Powerful (200K ctx)</option>
                    <option value="claude_sonnet">Claude Sonnet 4.5 — Best All-round (200K ctx)</option>
                    <option value="claude_haiku">Claude Haiku 3.5 — Fast &amp; Cheap (200K ctx)</option>
                  </>)}

                  {selectedProviderGroup === 'openai' && (<>
                    <option value="gpt41">GPT-4.1 — Latest Flagship (1M ctx)</option>
                    <option value="gpt4o">GPT-4o — Multimodal (128K ctx)</option>
                    <option value="gpt4o_mini">GPT-4o Mini — Budget Pick (128K ctx)</option>
                    <option value="o3">o3 — Advanced Reasoning (200K ctx)</option>
                    <option value="o4_mini">o4-mini — Reasoning Fast (200K ctx)</option>
                  </>)}

                  {selectedProviderGroup === 'gemini' && (<>
                    <option value="gemini_25_pro">Gemini 2.5 Pro — Best Quality (1M ctx)</option>
                    <option value="gemini_25_flash">Gemini 2.5 Flash — Fastest (1M ctx)</option>
                    <option value="gemini_20_flash">Gemini 2.0 Flash — Stable (1M ctx)</option>
                  </>)}

                  {selectedProviderGroup === 'mistral' && (<>
                    <option value="mistral_large">Mistral Large 2 — EU Hosted (131K ctx)</option>
                    <option value="codestral">Codestral — Code Specialist (256K ctx)</option>
                  </>)}

                  {selectedProviderGroup === 'deepseek' && (<>
                    <option value="deepseek_v3">DeepSeek V3 — Ultra Cheap (64K ctx)</option>
                    <option value="deepseek_deepseekcoder13b">DeepSeek-Coder-1.3B</option>
                    <option value="deepseek_deepseekcoder67b">DeepSeek-Coder-6.7B</option>
                    <option value="deepseek_deepseekcoder33b">DeepSeek-Coder-33B</option>
                    <option value="deepseek_deepseekcoderv1513b">DeepSeek-Coder-V1.5-1.3B</option>
                    <option value="deepseek_deepseekcoderv157b">DeepSeek-Coder-V1.5-7B</option>
                    <option value="deepseek_deepseekcoderv2litebase">DeepSeek-Coder-V2-Lite-Base</option>
                    <option value="deepseek_deepseekcoderv2liteinstruct">DeepSeek-Coder-V2-Lite-Instruct</option>
                    <option value="deepseek_deepseekcoderv2base">DeepSeek-Coder-V2-Base</option>
                    <option value="deepseek_deepseekcoderv2instruct">DeepSeek-Coder-V2-Instruct</option>
                    <option value="deepseek_deepseekcoderv2instruct0724">DeepSeek-Coder-V2-Instruct-0724</option>
                    <option value="deepseek_r1">DeepSeek R1 — Reasoning (64K ctx)</option>
                  </>)}

                  {selectedProviderGroup === 'groq' && (<>
                    <option value="groq_llama">Llama 3.3 70B — Ultra Fast (128K ctx)</option>
                    <option value="groq_grokcodefast1">grok-code-fast-1</option>
                    <option value="groq_grok1">Grok-1</option>
                    <option value="groq_grok15">Grok-1.5</option>
                    <option value="groq_grok15v">Grok-1.5V</option>
                    <option value="groq_grok2">Grok-2</option>
                    <option value="groq_grok2mini">Grok-2-mini</option>
                    <option value="groq_grok21212">Grok-2-1212</option>
                    <option value="groq_grok2vision1212">Grok-2-vision-1212</option>
                    <option value="groq_grok3">Grok-3</option>
                    <option value="groq_grok3mini">Grok-3-mini</option>
                    <option value="groq_grok3minifast">Grok-3-mini-fast</option>
                    <option value="groq_grok3minihigh">Grok-3-mini-high</option>
                    <option value="groq_grok4">Grok-4</option>
                    <option value="groq_grok40709">Grok-4-0709</option>
                    <option value="groq_grok4fast">Grok-4-fast</option>
                    <option value="groq_grok4fastreasoning">Grok-4-fast-reasoning</option>
                    <option value="groq_grok4fastnonreasoning">Grok-4-fast-non-reasoning</option>
                    <option value="groq_grok41">Grok-4.1</option>
                    <option value="groq_grok41fastreasoning">Grok-4.1-fast-reasoning</option>
                    <option value="groq_grok41fastnonreasoning">Grok-4.1-fast-non-reasoning</option>
                    <option value="groq_grokbuild01">grok-build-0.1</option>
                    <option value="groq_grok45">Grok-4.5</option>
                    <option value="groq_grok43">Grok-4.3</option>
                    <option value="groq_grok41fast">Grok-4.1-fast</option>
                  </>)}

                  {selectedProviderGroup === 'ollama' && (<>
                    <option value="ollama">Ollama — Qwen 2.5 Coder 7B (32K ctx)</option>
                  </>)}

                  {selectedProviderGroup === 'lmstudio' && (<>
                    <option value="lmstudio">LM Studio — Codestral 22B</option>
                  </>)}

                  {selectedProviderGroup === 'qwen' && (<>
                    <option value="qwen25_coder_32b">Qwen2.5 Coder 32B — Advanced Coding</option>
                    <option value="qwen_codeqwen157b">CodeQwen1.5-7B</option>
                    <option value="qwen_codeqwen157bchat">CodeQwen1.5-7B-Chat</option>
                    <option value="qwen_qwen25coder05b">Qwen2.5-Coder-0.5B</option>
                    <option value="qwen_qwen25coder05binstruct">Qwen2.5-Coder-0.5B-Instruct</option>
                    <option value="qwen_qwen25coder15b">Qwen2.5-Coder-1.5B</option>
                    <option value="qwen_qwen25coder15binstruct">Qwen2.5-Coder-1.5B-Instruct</option>
                    <option value="qwen_qwen25coder3b">Qwen2.5-Coder-3B</option>
                    <option value="qwen_qwen25coder3binstruct">Qwen2.5-Coder-3B-Instruct</option>
                    <option value="qwen_qwen25coder7b">Qwen2.5-Coder-7B</option>
                    <option value="qwen_qwen25coder14b">Qwen2.5-Coder-14B</option>
                    <option value="qwen_qwen25coder32b">Qwen2.5-Coder-32B</option>
                    <option value="qwen_qwen3coder30ba3binstruct">Qwen3-Coder-30B-A3B-Instruct</option>
                    <option value="qwen_qwen3coder480ba35binstruct">Qwen3-Coder-480B-A35B-Instruct</option>
                    <option value="qwen_qwen3coder480ba35binstructfp8">Qwen3-Coder-480B-A35B-Instruct-FP8</option>
                    <option value="qwen_qwen3codernext">Qwen3-Coder-Next</option>
                    <option value="qwen_qwen3codernextbase">Qwen3-Coder-Next-Base</option>
                    <option value="qwen25_coder_14b">Qwen2.5 Coder 14B — Balanced Coding</option>
                    <option value="qwen25_coder_7b">Qwen2.5 Coder 7B — Fast Coding</option>
                    <option value="qwen_coder_plus">Qwen Coder Plus — Enterprise</option>
                    <option value="qwen_coder_turbo">Qwen Coder Turbo — Enterprise Fast</option>
                    <option value="qwen_36_27b">Qwen 3.6 27B — RIL AI Foundry</option>
                    <option value="qwen_max">Qwen Max — Latest Flagship</option>
                    <option value="qwen_plus">Qwen Plus — Balanced</option>
                    <option value="qwen_turbo">Qwen Turbo — Fast</option>
                  </>)}
                </select>
              </div>
            </div>
            <p className="text-[9px] text-[var(--vscode-descriptionForeground)] mt-2">
              Model select karte hi saari fields auto-fill — sirf API Key enter karo aur Save karo.
            </p>
          </div>

          {/* Execution Mode (2-Way Toggle) */}
          <div>
            <label className="block text-[var(--vscode-foreground)] font-semibold mb-2">Execution / Connection Mode</label>
            <div className="flex bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md overflow-hidden p-0.5">
              <button
                type="button"
                onClick={() => setExecutionMode('local')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition rounded-sm ${
                  executionMode === 'local'
                    ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] font-bold shadow-sm'
                    : 'text-[var(--vscode-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span className="text-[11px]">Local Engine</span>
              </button>

              <button
                type="button"
                onClick={() => setExecutionMode('online_api')}
                className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition rounded-sm ${
                  executionMode === 'online_api'
                    ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] font-bold shadow-sm'
                    : 'text-[var(--vscode-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="text-[11px]">Online API Key</span>
              </button>
            </div>
          </div>

          {/* Model Display Name & Identifier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">Display Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. RIL AI Foundry (Qwen 27B)"
                className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)]"
              />
            </div>
            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">Model Identifier <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={modelString}
                onChange={(e) => setModelString(e.target.value)}
                placeholder="e.g. Qwen/Qwen3.6-27B or gpt-4.1-2025-04-14"
                className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Base URL and Endpoint */}
          {(executionMode !== 'online_api' || (provider !== 'anthropic' && provider !== 'gemini')) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[var(--vscode-foreground)] font-semibold">Base URL</label>
                  </div>
                  <input
                    type="text"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="e.g. http://127.0.0.1:11434"
                    className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
                  />
                  <p className="text-[9px] text-[var(--vscode-descriptionForeground)] mt-1.5 leading-tight">
                    Domain/IP without path (e.g. <code>http://127.0.0.1:11434</code>)
                  </p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[var(--vscode-foreground)] font-semibold">Endpoint</label>
                    <div className="flex gap-1.5 text-[10px] text-[var(--vscode-textLink-foreground)] font-mono">
                      <button type="button" onClick={() => setEndpointInput('/v1')} className="hover:underline">/v1</button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    placeholder="e.g. /v1"
                    className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
                  />
                  <p className="text-[9px] text-[var(--vscode-descriptionForeground)] mt-1.5 leading-tight">
                    Path suffix (e.g. <code>/v1</code>)
                  </p>
                </div>
              </div>
          )}

          {/* API Key */}
          {executionMode !== 'local' && (
            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">
                API Key <span className="text-[var(--vscode-descriptionForeground)] font-normal ml-1">(Leave blank if auth via headers)</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
              />
            </div>
          )}

          {/* Explicit Workspace ID / Deployment ID for Qwen/Anthropic */}
          {(provider === 'qwen' || provider === 'anthropic') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">
                  Workspace ID <span className="text-[var(--vscode-descriptionForeground)] font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="e.g. d33a71f5-..."
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">
                  Deployment ID <span className="text-[var(--vscode-descriptionForeground)] font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={deploymentId}
                  onChange={(e) => setDeploymentId(e.target.value)}
                  placeholder="e.g. dep-..."
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
                />
              </div>
            </div>
          )}

          {/* Custom Headers */}
          {(provider === 'qwen' || provider === 'anthropic' || headers.length > 0) && (
            <div className="p-3 rounded-lg bg-[var(--vscode-input-background)] border border-[var(--vscode-widget-border)]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[var(--vscode-foreground)] font-semibold flex flex-col">
                  <span>Optional Request Headers</span>
                  <span className="text-[9px] text-[var(--vscode-descriptionForeground)] font-normal">e.g. workspace-id, deployment-id</span>
                </label>
                <button
                  type="button"
                  onClick={() => setHeaders((prev) => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-1 text-[11px] text-[var(--vscode-button-background)] hover:text-[var(--vscode-button-hoverBackground)] font-bold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Header</span>
                </button>
              </div>

              {headers.length === 0 ? (
                <p className="text-[11px] text-[var(--vscode-descriptionForeground)] italic">No custom request headers configured.</p>
              ) : (
                <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                  {headers.map((h, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="workspace-id"
                        value={h.key}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[index]!.key = e.target.value;
                          setHeaders(updated);
                        }}
                        className="flex-1 bg-[var(--vscode-editor-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded px-2 py-1 outline-none font-mono text-[11px]"
                      />
                      <input
                        type="text"
                        placeholder="d33a71f5-..."
                        value={h.value}
                        onChange={(e) => {
                          const updated = [...headers];
                          updated[index]!.value = e.target.value;
                          setHeaders(updated);
                        }}
                        className="flex-1 bg-[var(--vscode-editor-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded px-2 py-1 outline-none font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => setHeaders((prev) => prev.filter((_, i) => i !== index))}
                        className="p-1 hover:bg-red-500/20 text-red-500 rounded transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Model Roles & Capabilities */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">Assigned Roles</label>
              <div className="flex flex-wrap gap-1.5">
                {(['chat', 'edit', 'apply', 'autocomplete'] as ModelRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold flex items-center gap-1 transition ${
                      roles.includes(role)
                        ? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
                        : 'bg-[var(--vscode-editor-background)] text-[var(--vscode-descriptionForeground)] border border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]'
                    }`}
                  >
                    {roles.includes(role) && <Check className="w-3 h-3" />}
                    <span>{role}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">Capabilities</label>
              <div className="flex flex-wrap gap-1.5">
                {(['image_input', 'tools', 'fim'] as ModelCapability[]).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold flex items-center gap-1 transition ${
                      capabilities.includes(cap)
                        ? 'bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]'
                        : 'bg-[var(--vscode-editor-background)] text-[var(--vscode-descriptionForeground)] border border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]'
                    }`}
                  >
                    {capabilities.includes(cap) && <Check className="w-3 h-3" />}
                    <span>{cap}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Context Length & Max Tokens */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">Context Length (Tokens)</label>
              <input
                type="number"
                value={contextLength}
                onChange={(e) => setContextLength(Number(e.target.value))}
                className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-[var(--vscode-foreground)] font-semibold mb-1">Max Output Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-md px-2.5 py-1.5 outline-none focus:border-[var(--vscode-focusBorder)] font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--vscode-widget-border)] mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-[var(--vscode-button-secondaryBackground)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] font-semibold transition shadow-sm"
            >
              {model ? 'Save Config' : 'Add Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
