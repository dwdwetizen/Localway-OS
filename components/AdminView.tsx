'use client';

import React, { useState } from 'react';
import {
  Settings,
  Users,
  ShieldCheck,
  Palette,
  Key,
  Cpu,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
} from 'lucide-react';

interface AdminViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function AdminView({ onShowToast }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'integracoes' | 'usuarios' | 'brand' | 'config'>('integracoes');
  const [showApiKey, setShowApiKey] = useState(false);
  const [geminiKey, setGeminiKey] = useState('AIzaSyD-G15M98aK22pX-9831a2kZ008821a');
  const [primaryTheme, setPrimaryTheme] = useState('blue');

  const [usersList, setUsersList] = useState([
    { id: '1', name: 'Ricardo Silva', email: 'ricardo@agenciascale.com.br', role: 'Administrador', status: 'Ativo' },
    { id: '2', name: 'Ana Martins', email: 'ana@agenciascale.com.br', role: 'Gestor de Contas', status: 'Ativo' },
    { id: '3', name: 'Felipe Prates', email: 'felipe@agenciascale.com.br', role: 'Vendedor', status: 'Aguardando' },
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Administração & Configurações da Agência
          </h2>
          <p className="text-xs text-[#727687]">
            Gestão de chaves de API, integrações Google, modelo de IA e permissões da equipe
          </p>
        </div>

        <button
          onClick={() => onShowToast('Todas as alterações administrativas salvas com sucesso!')}
          className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
        >
          Salvar Alterações
        </button>
      </div>

      {/* Admin Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#c2c6d8]/30 dark:border-[#2e366b] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('integracoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'integracoes'
              ? 'bg-[#0066ff] text-white shadow-sm'
              : 'text-[#727687] hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Cpu className="w-4 h-4" /> Integrações & Motores de IA
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'usuarios'
              ? 'bg-[#0066ff] text-white shadow-sm'
              : 'text-[#727687] hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Users className="w-4 h-4" /> Gestão de Usuários ({usersList.length})
        </button>

        <button
          onClick={() => setActiveTab('brand')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'brand'
              ? 'bg-[#0066ff] text-white shadow-sm'
              : 'text-[#727687] hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Palette className="w-4 h-4" /> Identidade Visual & Logo
        </button>
      </div>

      {/* Tab Content 1: Integrações & IA */}
      {activeTab === 'integracoes' && (
        <div className="space-y-6">
          {/* AI Engines Setup Section */}
          <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#c2c6d8]/20 dark:border-[#2e366b] pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#0066ff] animate-pulse" />
                <h3 className="font-bold font-poppins text-base text-[#1a1b22] dark:text-[#f8f7ff]">
                  Provedores de Inteligência Artificial
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Servidor Ativo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gemini Setup Card */}
              <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[#1a1b22] dark:text-[#f8f7ff]">
                      Google Gemini 3.6 Flash / 1.5 Pro
                    </h4>
                    <p className="text-[11px] text-[#727687]">Engine principal para PITCH, ROI e Resposta a Reviews</p>
                  </div>
                  <span className="text-[10px] font-extrabold bg-[#0066ff] text-white px-2 py-0.5 rounded">
                    PADRÃO
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#727687] block mb-1">
                    Chave de API do Gemini (GCP):
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 text-xs bg-white dark:bg-[#141936] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Monthly Quota Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-[#727687]">
                    <span>Consumo de Tokens do Mês:</span>
                    <span className="text-[#0066ff] font-bold">4.2M / 6.0M Tokens (65%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0066ff] rounded-full" style={{ width: '65%' }} />
                  </div>
                </div>
              </div>

              {/* Groq Setup Card */}
              <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[#1a1b22] dark:text-[#f8f7ff]">
                      Groq Cloud (Llama 3 Ultra-Fast)
                    </h4>
                    <p className="text-[11px] text-[#727687]">Inspecção ultrarápida de scripts em tempo real</p>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
                    CONECTADO
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#727687] block mb-1">
                    Chave API Groq:
                  </label>
                  <input
                    type="password"
                    value="gsk_98129841289471928471"
                    readOnly
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#141936] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl"
                  />
                </div>

                <div className="flex justify-between items-center text-xs pt-3">
                  <span className="text-[#727687]">Latência Média: <strong className="text-emerald-600">120ms</strong></span>
                  <button
                    onClick={() => onShowToast('Teste de conexão com Groq Cloud bem-sucedido!')}
                    className="text-[#0066ff] font-bold hover:underline"
                  >
                    Testar Conexão
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Google Ecosystem Status Cards */}
          <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm space-y-4">
            <h3 className="font-bold font-poppins text-base text-[#1a1b22] dark:text-[#f8f7ff]">
              Conexões do Ecossistema Google
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">Google Business Profile</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-[#727687]">42 Perfis de Clientes Conectados</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">Google Maps Geocoding API</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-[11px] text-[#727687]">Chave Válida • Raio-X Ativo</p>
              </div>

              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">Google Calendar OAuth</span>
                  <button
                    onClick={() => onShowToast('OAuth do Google Calendar iniciado com sucesso!')}
                    className="text-[10px] font-bold text-[#0066ff] hover:underline"
                  >
                    Conectar
                  </button>
                </div>
                <p className="text-[11px] text-[#727687]">Sincronizar Reuniões de Vendas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Usuários */}
      {activeTab === 'usuarios' && (
        <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
          <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border-b border-[#c2c6d8]/30 flex justify-between items-center">
            <span className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">
              Membros e Permissões da Equipe
            </span>
            <button
              onClick={() => {
                const email = prompt('E-mail do novo membro:');
                if (email) {
                  setUsersList(prev => [
                    ...prev,
                    { id: String(Date.now()), name: email.split('@')[0], email, role: 'Gestor de Contas', status: 'Aguardando' },
                  ]);
                  onShowToast(`Convite enviado para ${email}!`);
                }
              }}
              className="px-3.5 py-2 bg-[#0066ff] text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Convidar Membro
            </button>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/40 text-[#727687] font-bold uppercase border-b border-[#c2c6d8]/20">
              <tr>
                <th className="p-4">Usuário</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Permissão</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="p-4 font-bold text-[#1a1b22] dark:text-[#f8f7ff]">{u.name}</td>
                  <td className="p-4 text-[#727687]">{u.email}</td>
                  <td className="p-4 font-bold text-[#0066ff]">{u.role}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      u.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setUsersList(prev => prev.filter(i => i.id !== u.id));
                        onShowToast(`Usuário ${u.name} removido da agência.`);
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content 3: Identidade Visual */}
      {activeTab === 'brand' && (
        <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm space-y-6">
          <h3 className="font-bold font-poppins text-base text-[#1a1b22] dark:text-[#f8f7ff]">
            Personalização de Marca para Propostas e Interface
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-[#727687] block mb-2">
                Logo da Sua Agência (PNG / SVG sem fundo):
              </label>
              <div className="p-6 border-2 border-dashed border-[#c2c6d8]/40 rounded-2xl text-center space-y-2 cursor-pointer hover:border-[#0066ff] transition-colors">
                <Sparkles className="w-8 h-8 text-[#0066ff] mx-auto" />
                <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
                  Clique para enviar o arquivo da sua logo
                </p>
                <p className="text-[10px] text-[#727687]">Formatos aceitos: SVG, PNG HD (Máx. 5MB)</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#727687] block mb-2">
                Cor Primária da Interface da Agência:
              </label>
              <div className="flex gap-3">
                {[
                  { id: 'blue', color: 'bg-[#0066ff]', name: 'Azul Premium' },
                  { id: 'purple', color: 'bg-purple-600', name: 'Roxo Royal' },
                  { id: 'emerald', color: 'bg-emerald-600', name: 'Verde Emerald' },
                  { id: 'red', color: 'bg-rose-600', name: 'Vermelho Crimson' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setPrimaryTheme(c.id);
                      onShowToast(`Tema alterado para ${c.name}!`);
                    }}
                    className={`w-10 h-10 rounded-xl ${c.color} ring-4 transition-all ${
                      primaryTheme === c.id ? 'ring-gray-400 dark:ring-white scale-110' : 'ring-transparent'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
