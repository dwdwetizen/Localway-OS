'use client';

/* Signed Supabase avatar URLs expire, so the native image element is intentional. */
/* eslint-disable @next/next/no-img-element */

import React from 'react';
import {
  LayoutDashboard,
  SearchCheck,
  TrendingUp,
  Map,
  Radar,
  Building2,
  PhoneCall,
  KanbanSquare,
  FileText,
  Package,
  Users,
  Star,
  Shield,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';

export type TabType =
  | 'dashboard'
  | 'analises'
  | 'volume'
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
  onLogout: () => void;
  isLoggingOut: boolean;
  allowedTabs: TabType[];
}

export function Sidebar({
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
  onLogout,
  isLoggingOut,
  allowedTabs,
}: SidebarProps) {
  const profile = useAuthProfile();
  const navItems: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    group: 'Operação' | 'Inteligência' | 'Gestão';
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Operação' },
    { id: 'prospeccao', label: 'Prospecção', icon: Building2, group: 'Operação' },
    { id: 'followup', label: 'Follow-up', icon: PhoneCall, group: 'Operação' },
    { id: 'crm', label: 'CRM', icon: KanbanSquare, group: 'Operação' },
    { id: 'analises', label: 'Análises de Perfil', icon: SearchCheck, group: 'Inteligência' },
    { id: 'volume', label: 'Volume de Busca', icon: TrendingUp, group: 'Inteligência' },
    { id: 'mapa', label: 'Mapa de Calor', icon: Map, group: 'Inteligência' },
    { id: 'raiox', label: 'Radar de Concorrentes', icon: Radar, group: 'Inteligência' },
    { id: 'avaliacoes', label: 'Avaliações', icon: Star, group: 'Inteligência', badge: 'IA' },
    { id: 'propostas', label: 'Propostas', icon: FileText, group: 'Gestão' },
    { id: 'servicos', label: 'Meus Serviços', icon: Package, group: 'Gestão' },
    { id: 'equipe', label: 'Visão da Equipe', icon: Users, group: 'Gestão' },
    { id: 'admin', label: 'Administração', icon: Shield, group: 'Gestão' },
  ];
  const groups = ['Operação', 'Inteligência', 'Gestão'] as const;
  const visibleItems = navItems.filter(item => allowedTabs.includes(item.id));

  const content = (
    <aside className="w-[min(86vw,304px)] lg:w-[248px] h-[100dvh] bg-[#111522] dark:bg-[#080b16] text-[#e3e1ec] flex flex-col border-r border-white/8 shadow-xl select-none mobile-safe-bottom">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1268ff] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#1268ff]/25 font-bold">
            <Sparkles className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-extrabold text-white tracking-tight leading-tight">
              LocalWay OS
            </h1>
            <p className="text-[10px] text-[#7f879d] font-medium tracking-wide">
              Marketing local
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
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map(group => {
          const groupItems = visibleItems.filter(item => item.group === group);
          if (!groupItems.length) return null;
          return <section key={group} className="mb-4 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-[#657087] uppercase">
              {group}
            </p>
            <div className="space-y-0.5">
              {groupItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full min-h-10 flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] transition-all ${
                      isActive
                        ? 'bg-[#1268ff] text-white shadow-sm shadow-[#1268ff]/20 font-semibold'
                        : 'text-[#aeb6c8] hover:bg-white/6 hover:text-white font-medium'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#737d93]'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#1268ff]/15 text-[#6ea2ff]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>;
        })}
      </nav>

      {/* Footer Navigation */}
      <div className="border-t border-white/8 p-2.5">
        <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-white/5">
          <div className="w-8 h-8 shrink-0 rounded-full bg-[#1268ff] text-white grid place-items-center text-[11px] font-bold overflow-hidden">
            {profile.photo_url
              ? <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
              : (profile.nome || profile.username).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-white">{profile.nome || profile.username}</p>
            <p className="truncate text-[9px] text-[#778096]">{profile.role || 'Colaborador'}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="w-8 h-8 grid place-items-center hover:bg-white/10 rounded-lg text-[#778096] hover:text-rose-300 transition-colors disabled:cursor-wait disabled:opacity-50"
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

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 dark:bg-[#141936]/95 backdrop-blur-xl border-t border-[#c2c6d8]/40 dark:border-[#2e366b] px-1 pt-1 mobile-safe-bottom">
        <div className="grid grid-cols-4">
          {visibleItems
            .filter(item => ['dashboard', 'prospeccao', 'followup', 'crm'].includes(item.id) && allowedTabs.includes(item.id))
            .map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={`mobile-${item.id}`}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-colors ${
                    isActive ? 'text-[#0066ff] bg-[#0066ff]/8' : 'text-[#727687]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.id === 'dashboard' ? 'Início' : item.label.replace(' (Vendas)', '')}</span>
                </button>
              );
            })}
        </div>
      </nav>
    </>
  );
}
