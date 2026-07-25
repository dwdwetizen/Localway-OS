'use client';

/* Signed Supabase avatar URLs expire, so the native image element is intentional. */
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import { Search, Bell, Moon, Sun, HelpCircle, Menu, Check } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenMobileSidebar: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onOpenSupport: () => void;
}

export function Header({
  darkMode,
  setDarkMode,
  onOpenMobileSidebar,
  searchTerm,
  setSearchTerm,
  onOpenSupport,
}: HeaderProps) {
  const profile = useAuthProfile();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Novo lead qualificado', time: 'Há 5 min', unread: true },
    { id: '2', title: 'Rating da Padaria Silva caiu', time: 'Há 25 min', unread: true },
    { id: '3', title: 'Relatório GBP mensal disponível', time: 'Há 2 hrs', unread: false },
  ]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="sticky top-0 z-40 h-16 bg-white dark:bg-[#141936] border-b border-[#c2c6d8]/40 dark:border-[#2e366b] px-4 md:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3 w-full max-w-md">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          aria-label="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar empresas, leads ou relatórios..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border-none rounded-full focus:outline-none focus:ring-2 focus:ring-[#0066ff] placeholder-[#727687] transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[#424656] dark:text-[#b0b4ce] hover:bg-[#f4f2fd] dark:hover:bg-[#1d234a] rounded-full transition-all"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white dark:ring-[#141936]" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#141936] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-2xl shadow-xl p-4 z-50">
              <div className="flex items-center justify-between mb-3 border-b border-[#c2c6d8]/20 dark:border-[#2e366b] pb-2">
                <h4 className="font-semibold text-sm text-[#1a1b22] dark:text-[#f8f7ff]">
                  Notificações ({unreadCount})
                </h4>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[#0066ff] hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Lidas
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl text-xs transition-colors ${
                      n.unread
                        ? 'bg-[#0066ff]/10 dark:bg-[#0066ff]/20 font-medium'
                        : 'bg-gray-50 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div className="flex justify-between text-xs text-[#1a1b22] dark:text-[#f8f7ff]">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-[#727687]">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(prev => !prev)}
          className="p-2 text-[#424656] dark:text-[#b0b4ce] hover:bg-[#f4f2fd] dark:hover:bg-[#1d234a] rounded-full transition-all"
          title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="h-6 w-px bg-[#c2c6d8]/40 dark:bg-[#2e366b] hidden sm:block" />

        {/* Support */}
        <button
          onClick={onOpenSupport}
          className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-[#0050cb] dark:text-[#3b82f6] hover:bg-[#0066ff]/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Suporte
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-1 group">
          <div className="w-9 h-9 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-sm overflow-hidden border border-[#0066ff]/30 shadow-sm">
            {profile.photo_url
              ? <img src={profile.photo_url} alt={profile.nome || profile.email} className="w-full h-full object-cover" />
              : <span>{(profile.nome || profile.email).slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="hidden lg:block text-left leading-tight">
            <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
              {profile.nome || 'Usuário'}
            </p>
            <p className="text-[10px] text-[#727687] font-semibold max-w-40 truncate">
              {profile.email}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
