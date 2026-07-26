'use client';

import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  MapPin,
  Crosshair,
  Search,
  History,
  Handshake,
  FileText,
  Briefcase,
  Users,
  MessageSquare,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'analises'
  | 'mapa'
  | 'raiox'
  | 'prospeccao'
  | 'followup'
  | 'crm'
  | 'propostas'
  | 'servicos'
  | 'equipe'
  | 'avaliacoes'
  | 'admin';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenSupport: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  allowedTabs: TabType[];
}

export function Sidebar({
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
  onOpenSupport,
  onLogout,
  isLoggingOut,
  allowedTabs,
}: SidebarProps) {
  const navItems: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analises', label: 'Análises de Perfil', icon: BarChart3 },
    { id: 'mapa', label: 'Mapa de Calor', icon: MapPin },
    { id: 'raiox', label: 'Radar de Concorrentes', icon: Crosshair },
    { id: 'prospeccao', label: 'Prospecção', icon: Search, badge: 'IA' },
    { id: 'followup', label: 'Follow-up', icon: History },
    { id: 'crm', label: 'CRM (Vendas)', icon: Handshake, badge: 'IA' },
    { id: 'propostas', label: 'Propostas', icon: FileText },
    { id: 'servicos', label: 'Meus Serviços', icon: Briefcase },
    { id: 'equipe', label: 'Visão da Equipe', icon: Users },
    { id: 'avaliacoes', label: 'Gestão de Avaliações', icon: MessageSquare, badge: 'IA' },
    { id: 'admin', label: 'Administração', icon: Settings },
  ];

  const content = (
    <aside className="w-[280px] h-full bg-[#1a1b22] dark:bg-[#060919] text-[#e3e1ec] flex flex-col py-5 px-3 border-r border-[#2e366b]/30 shadow-xl select-none">
      {/* Brand Header */}
      <div className="px-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0066ff] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#0066ff]/30 font-bold">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-headline-sm font-bold text-white tracking-tight leading-tight">
              LocalWay OS
            </h1>
            <p className="text-[11px] text-[#727687] font-medium tracking-wide">
              Agência Marketing Local
            </p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.filter(item => allowedTabs.includes(item.id)).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as TabType);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
                isActive
                  ? 'bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/20 font-semibold'
                  : 'text-[#c2c6d8] hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#727687]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#0066ff]/20 text-[#3b82f6]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Navigation */}
      <div className="pt-4 mt-2 border-t border-white/10 space-y-1">
        <button
          onClick={onOpenSupport}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs text-[#c2c6d8] hover:bg-white/5 hover:text-white transition-all"
        >
          <HelpCircle className="w-4 h-4 text-[#727687]" />
          <span>Suporte & Ajuda</span>
        </button>

        <div className="p-3 bg-white/5 rounded-xl mt-3 flex items-center justify-between">
          <div className="text-[11px]">
            <p className="text-white font-semibold">Agência Scale Pro</p>
            <p className="text-[#727687]">42 GBPs Ativos</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="p-1.5 hover:bg-white/10 rounded-lg text-rose-400 hover:text-rose-300 transition-colors disabled:cursor-wait disabled:opacity-50"
            title={isLoggingOut ? 'Saindo…' : 'Sair'}
            aria-label={isLoggingOut ? 'Saindo da conta' : 'Sair da conta'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen z-30">
        {content}
      </div>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
}
