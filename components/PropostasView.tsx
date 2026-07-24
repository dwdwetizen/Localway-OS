'use client';

import React, { useState } from 'react';
import { FileText, Plus, Download, Eye, CheckCircle2, Clock, Sparkles, Send } from 'lucide-react';

interface PropostasViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function PropostasView({ onShowToast }: PropostasViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [leadName, setLeadName] = useState('Padaria & Confeitaria Silva');
  const [selectedService, setSelectedService] = useState('Setup Otimização GBP + Gestão Reputação IA');
  const [price, setPrice] = useState('2400');

  const [proposals, setProposals] = useState([
    { id: '1', lead: 'Padaria & Confeitaria Silva', date: 'Há 2 dias', value: 'R$ 2.400,00', status: 'Enviado' },
    { id: '2', lead: 'Clínica Sorriso Premium', date: 'Ontem', value: 'R$ 3.500,00', status: 'Aprovado' },
    { id: '3', lead: 'Auto Center Radial', date: 'Há 5 dias', value: 'R$ 1.800,00', status: 'Pendente' },
  ]);

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    setProposals(prev => [
      { id: String(Date.now()), lead: leadName, date: 'Agora', value: `R$ ${Number(price).toLocaleString('pt-BR')},00`, status: 'Enviado' },
      ...prev,
    ]);
    setShowModal(false);
    onShowToast(`Proposta comercial para "${leadName}" gerada com sucesso!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Propostas Comerciais & Envio PDF
          </h2>
          <p className="text-xs text-[#727687]">
            Gerador automático de apresentações comerciais de marketing local e auditorias
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nova Proposta Comercial
        </button>
      </div>

      {/* Proposal Table */}
      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687] font-bold uppercase border-b border-[#c2c6d8]/30">
            <tr>
              <th className="p-4">Cliente / Lead</th>
              <th className="p-4">Data Envio</th>
              <th className="p-4">Valor Total</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
            {proposals.map((prop) => (
              <tr key={prop.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="p-4 font-bold text-[#1a1b22] dark:text-[#f8f7ff]">{prop.lead}</td>
                <td className="p-4 text-[#727687]">{prop.date}</td>
                <td className="p-4 font-bold font-poppins text-emerald-600">{prop.value}</td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      prop.status === 'Aprovado'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                    }`}
                  >
                    {prop.status}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => onShowToast(`Proposta em PDF baixada para ${prop.lead}`)}
                    className="p-1.5 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg"
                    title="Baixar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onShowToast(`Link de proposta reenviado via WhatsApp para ${prop.lead}`)}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Reenviar WhatsApp"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nova Proposta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/40 dark:border-[#2e366b] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
              Criar Nova Proposta Comercial
            </h3>

            <form onSubmit={handleCreateProposal} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#727687] block mb-1">Nome do Cliente / Lead:</label>
                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full p-2.5 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl text-[#1a1b22] dark:text-[#f8f7ff]"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-[#727687] block mb-1">Pacote de Serviços:</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full p-2.5 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl text-[#1a1b22] dark:text-[#f8f7ff]"
                >
                  <option>Setup Otimização GBP + Gestão Reputação IA</option>
                  <option>Pacote Escala Total Maps (GBP + Tráfego Pago Local)</option>
                  <option>Auditoria & Otimização Única GBP</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#727687] block mb-1">Valor do Contrato (R$):</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full p-2.5 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl text-[#1a1b22] dark:text-[#f8f7ff]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold rounded-xl shadow"
                >
                  Gerar PDF & Proposta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
