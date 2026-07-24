'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface ServicosViewProps { onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void; }

const services = [
  { title: 'Setup & Otimização Completa GBP', price: 'R$ 1.500,00', period: 'Taxa única', description: 'Auditoria completa do perfil do Google, categorias, fotos e serviços.', features: ['Diagnóstico de Raio-X Geográfico', 'Cadastro de produtos e serviços', 'Geotag de fotos HD', 'Categoria otimizada'], badge: 'MAIS POPULAR' },
  { title: 'Gestão de Reputação & Avaliações IA', price: 'R$ 890,00', period: '/mês', description: 'Respostas humanizadas a avaliações e acompanhamento de reputação.', features: ['Respostas com IA', 'Alerta de nota baixa', 'QR Code para avaliações', 'Relatório mensal'], badge: 'IA EXCLUSIVO' },
  { title: 'Escala Local Total', price: 'R$ 2.900,00', period: '/mês', description: 'SEO local contínuo e crescimento no Google Maps.', features: ['Tráfego para Maps', 'Otimização semanal', 'Gestor dedicado', 'Plano de crescimento'], badge: 'VIP PREMIUM' },
];

export function ServicosView({ onShowToast }: ServicosViewProps) {
  return <div className="space-y-6 animate-in fade-in duration-300"><div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm"><h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">Catálogo de Serviços da Agência</h2><p className="text-xs text-[#727687]">Os serviços são cadastrados e administrados na aba Administração.</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{services.map(service => <div key={service.title} className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col justify-between relative"><span className="absolute top-4 right-4 text-[9px] font-extrabold uppercase px-2 py-1 bg-[#0066ff]/10 text-[#0066ff] rounded-md">{service.badge}</span><div className="space-y-4"><h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">{service.title}</h3><div><span className="text-2xl font-black font-poppins text-[#0066ff]">{service.price}</span><span className="text-xs text-[#727687] ml-1">{service.period}</span></div><p className="text-xs text-[#424656] dark:text-[#b0b4ce]">{service.description}</p><div className="pt-4 border-t border-[#c2c6d8]/20 space-y-2 text-xs">{service.features.map(feature => <div key={feature} className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0"/>{feature}</div>)}</div></div><button onClick={() => onShowToast(`Pacote ${service.title} selecionado para a proposta.`)} className="mt-6 w-full py-2.5 bg-[#f4f2fd] dark:bg-[#10142e] hover:bg-[#0066ff] hover:text-white text-[#0066ff] font-bold text-xs rounded-xl border border-[#0066ff]/20">Usar em proposta comercial</button></div>)}</div></div>;
}
