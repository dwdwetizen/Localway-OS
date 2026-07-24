'use client';

import React, { useState } from 'react';
import { Sparkles, Copy, Send, Check, X, RefreshCw, MessageSquare } from 'lucide-react';

interface AiPitchModalProps {
  companyName: string;
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function AiPitchModal({ companyName, onClose, onShowToast }: AiPitchModalProps) {
  const [loading, setLoading] = useState(false);
  const [pitchText, setPitchText] = useState('');
  const [copied, setCopied] = useState(false);
  const [category, setCategory] = useState('Comércio / Serviço Local');

  const handleGeneratePitch = async () => {
    setLoading(true);
    setPitchText('');
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_pitch',
          companyName,
          category,
          rating: '4.2',
          issue: 'Perfil sem postagens atualizadas, fotos antigas e sem resposta rápida a comentários de clientes.',
        }),
      });

      const data = await res.json();
      if (data.result) {
        setPitchText(data.result);
      } else {
        setPitchText(
          `Olá! Analisei o perfil da ${companyName} no Google Maps e percebi que você está perdendo cerca de 35% das chamadas da região para concorrentes locais devido a pequenos ajustes no cadastro. Temos um plano para colocar sua empresa no Top 3 da sua bairro esta semana. Podemos conversar 5 minutos amanhã?`
        );
      }
    } catch (err) {
      setPitchText(
        `Olá! Notamos uma oportunidade excelente para a ${companyName} no Google Maps. Seu perfil possui um grande volume de buscas locais não aproveitadas. Gostaria de ver o diagnóstico de raio-x gratuito que preparamos para o seu segmento?`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pitchText);
    setCopied(true);
    onShowToast('Pitch copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/40 dark:border-[#2e366b] max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-[#0066ff]">
          <Sparkles className="w-5 h-5 animate-pulse" />
          <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
            Gerador de Pitch de Vendas IA
          </h3>
        </div>

        <p className="text-xs text-[#727687]">
          Empresa Alvo: <strong className="text-[#1a1b22] dark:text-[#f8f7ff]">{companyName}</strong>
        </p>

        {!pitchText && !loading && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-[#727687] block mb-1">Segmento da Empresa:</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl text-xs text-[#1a1b22] dark:text-[#f8f7ff]"
              />
            </div>

            <button
              onClick={handleGeneratePitch}
              className="w-full py-3 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Gerar Mensagem de Abordagem WhatsApp
            </button>
          </div>
        )}

        {loading && (
          <div className="p-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#0066ff] animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
              O Gemini IA está redigindo o pitch persuasivo para {companyName}...
            </p>
          </div>
        )}

        {pitchText && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] rounded-xl border border-[#c2c6d8]/30 text-xs text-[#1a1b22] dark:text-[#f8f7ff] leading-relaxed whitespace-pre-wrap">
              {pitchText}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-[#1a1b22] dark:text-[#f8f7ff] font-bold text-xs rounded-xl flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>

              <button
                onClick={() => {
                  const encoded = encodeURIComponent(pitchText);
                  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
                  onShowToast('Abrindo WhatsApp Web para envio!');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow"
              >
                <Send className="w-4 h-4" /> Enviar WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
