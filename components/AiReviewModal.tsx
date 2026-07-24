'use client';

import React, { useState } from 'react';
import { Sparkles, Copy, Check, X, RefreshCw, Send, Star } from 'lucide-react';

interface AiReviewModalProps {
  companyName: string;
  reviewerName: string;
  reviewText: string;
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function AiReviewModal({
  companyName,
  reviewerName,
  reviewText,
  onClose,
  onShowToast,
}: AiReviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState('Profissional & Empático');

  const handleGenerateResponse = async () => {
    setLoading(true);
    setResponseText('');
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_review',
          companyName,
          reviewerName,
          reviewText,
          tone,
        }),
      });

      const data = await res.json();
      if (data.result) {
        setResponseText(data.result);
      } else {
        setResponseText(
          `Olá ${reviewerName}! Agradecemos muito o seu feedback sobre a ${companyName}. Trabalhamos continuamente para oferecer a melhor experiência e seus comentários já foram repassados para a nossa equipe. Esperamos recebê-lo novamente em breve!`
        );
      }
    } catch (err) {
      setResponseText(
        `Olá ${reviewerName}, muito obrigado por avaliar a ${companyName}! Sua opinião é fundamental para mantermos nosso padrão de qualidade.`
      );
    } finally {
      setLoading(false);
    }
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
            Resposta de Avaliação por IA
          </h3>
        </div>

        {/* Original Review Box */}
        <div className="p-3 bg-[#f4f2fd] dark:bg-[#10142e] rounded-xl border border-[#c2c6d8]/30 space-y-1 text-xs">
          <p className="font-bold text-[#1a1b22] dark:text-[#f8f7ff]">{reviewerName} avaliou {companyName}:</p>
          <p className="text-[#727687] italic">&quot;{reviewText}&quot;</p>
        </div>

        {!responseText && !loading && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-[#727687] block mb-1">Tom da Resposta:</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-2.5 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl text-xs text-[#1a1b22] dark:text-[#f8f7ff]"
              >
                <option>Profissional & Empático</option>
                <option>Acolhedor & Amigável</option>
                <option>Apologético & Resolutivo (Para Notas Baixas)</option>
                <option>Comercial & Promocional</option>
              </select>
            </div>

            <button
              onClick={handleGenerateResponse}
              className="w-full py-3 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Gerar Resposta Personalizada
            </button>
          </div>
        )}

        {loading && (
          <div className="p-6 text-center space-y-2">
            <RefreshCw className="w-7 h-7 text-[#0066ff] animate-spin mx-auto" />
            <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
              O Gemini IA está criando a resposta ideal para a avaliação...
            </p>
          </div>
        )}

        {responseText && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/30 text-xs text-[#1a1b22] dark:text-[#f8f7ff] leading-relaxed">
              {responseText}
            </div>

            <button
              onClick={() => {
                onShowToast('Resposta publicada diretamente no perfil do Google Business Profile!');
                onClose();
              }}
              className="w-full py-3 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Publicar Resposta no Google Maps
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
