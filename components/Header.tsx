'use client';

/* Signed Supabase avatar URLs expire, so the native image element is intentional. */
/* eslint-disable @next/next/no-img-element */

import React, { useState } from 'react';
import { Search, Bell, Moon, Sun, Menu, Check, Repeat2 } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenMobileSidebar: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSwitchAccount: () => void;
  isSwitchingAccount: boolean;
}

export function Header({
  darkMode,
  setDarkMode,
  onOpenMobileSidebar,
  searchTerm,
  setSearchTerm,
  onSwitchAccount,
  isSwitchingAccount,
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
    <header className="sticky top-0 z-40 min-h-12 bg-white/95 dark:bg-[#151a28]/95 backdrop-blur-xl border-b border-[var(--border-subtle)] px-3 py-1.5 flex flex-wrap lg:flex-nowrap items-center gap-2 transition-colors">
      <button
        onClick={onOpenMobileSidebar}
        className="order-1 lg:hidden w-8 h-8 grid place-items-center text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)] rounded-md"
        aria-label="Abrir Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="order-3 lg:order-1 relative w-full lg:max-w-xs lg:flex-1">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar empresa, lead ou negócio"
            className="w-full h-8 pl-9 pr-3 text-[11px] bg-[var(--surface-container-low)] text-[var(--text-primary)] border border-transparent rounded-md focus:outline-none focus:border-[var(--primary-main)] focus:ring-2 focus:ring-[#1268ff]/10 placeholder-[var(--text-secondary)] transition-all"
          />
        </div>
      </div>

      <div className="order-2 ml-auto lg:order-2 flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-8 h-8 grid place-items-center text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)] rounded-md transition-all"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white dark:ring-[#141936]" />
            )}
          </button>

          {showNotifications && (
            <div className="fixed left-3 right-3 top-[6.6rem] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white dark:bg-[#141936] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-2xl shadow-xl p-4 z-50">
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
            className="w-8 h-8 grid place-items-center text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)] rounded-md transition-all"
          title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="h-6 w-px bg-[#c2c6d8]/40 dark:bg-[#2e366b] hidden sm:block" />

        <button
          onClick={onSwitchAccount}
          disabled={isSwitchingAccount}
          className="w-8 h-8 grid place-items-center text-xs font-semibold text-[var(--primary-main)] hover:bg-[#1268ff]/10 rounded-md transition-colors disabled:opacity-50"
          title="Trocar de conta"
        >
          <Repeat2 className={`w-4 h-4 ${isSwitchingAccount ? 'animate-spin' : ''}`} />
          <span className="hidden xl:inline">{isSwitchingAccount ? 'Trocando…' : 'Trocar conta'}</span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-1 group">
          <div className="w-8 h-8 rounded-full bg-[#1268ff] text-white flex items-center justify-center font-bold text-[11px] overflow-hidden border border-[#1268ff]/30 shadow-sm">
            {profile.photo_url
              ? <img src={profile.photo_url} alt={profile.nome || profile.username} className="w-full h-full object-cover" />
              : <span>{(profile.nome || profile.username).slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="hidden lg:block text-left leading-tight">
            <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
              {profile.nome || 'Usuário'}
            </p>
            <p className="text-[10px] text-[#727687] font-semibold max-w-40 truncate">
              @{profile.username}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
