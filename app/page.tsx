'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Sidebar, TabType } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { DashboardView } from '@/components/DashboardView';
import { AnalisesView } from '@/components/AnalisesView';
import { HeatmapView } from '@/components/HeatmapView';
import { RaioXView } from '@/components/RaioXView';
import { ProspectingView } from '@/components/ProspectingView';
import { FollowUpView } from '@/components/FollowUpView';
import { CrmView } from '@/components/CrmView';
import { PropostasView } from '@/components/PropostasView';
import { ServicosView } from '@/components/ServicosView';
import { EquipeView } from '@/components/EquipeView';
import { AvaliacoesView } from '@/components/AvaliacoesView';
import { AdminView } from '@/components/AdminView';
import { ToastContainer, ToastMessage } from '@/components/Toast';
import { AiPitchModal } from '@/components/AiPitchModal';
import { AiReviewModal } from '@/components/AiReviewModal';
import { SupportModal } from '@/components/SupportModal';
import { AuthGate, useAuthProfile } from '@/components/AuthGate';
import { Lead } from '@/lib/leads';
import { supabase, supabaseConfigurationError } from '@/lib/supabase';

const permissionByTab: Record<Exclude<TabType, 'admin'>, string[]> = {
  dashboard: ['Dashboard', 'dashboard'],
  analises: ['Análises', 'analises'],
  mapa: ['Mapa', 'mapa'],
  raiox: ['Raio-X', 'raiox'],
  prospeccao: ['Prospecção', 'prospeccao'],
  followup: ['Follow-up', 'followup'],
  crm: ['CRM', 'crm'],
  propostas: ['Propostas', 'propostas'],
  servicos: ['Meus Serviços', 'servicos'],
  equipe: ['Equipe', 'equipe'],
  avaliacoes: ['Avaliações', 'avaliacoes'],
};

const allTabs: TabType[] = [
  'dashboard',
  'analises',
  'mapa',
  'raiox',
  'prospeccao',
  'followup',
  'crm',
  'propostas',
  'servicos',
  'equipe',
  'avaliacoes',
  'admin',
];

export default function Home() {
  return <AuthGate><AuthenticatedHome /></AuthGate>;
}

function AuthenticatedHome() {
  const profile = useAuthProfile();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Modals state
  const [aiPitchData, setAiPitchData] = useState<{ isOpen: boolean; companyName: string; lead?: Lead }>({
    isOpen: false,
    companyName: '',
  });

  const [aiReviewData, setAiReviewData] = useState<{
    isOpen: boolean;
    companyName: string;
    reviewerName: string;
    reviewText: string;
  }>({
    isOpen: false,
    companyName: '',
    reviewerName: '',
    reviewText: '',
  });

  const [showSupportModal, setShowSupportModal] = useState(false);
  const isAdmin = ['admin', 'administrador'].includes((profile.role || '').trim().toLowerCase());
  const allowedTabs = useMemo<TabType[]>(() => {
    if (isAdmin) return allTabs;
    const permissions = profile.permissions || [];
    return allTabs.filter((tab): tab is Exclude<TabType, 'admin'> =>
      tab !== 'admin' && (tab === 'dashboard' || permissionByTab[tab].some(permission => permissions.includes(permission)))
    );
  }, [isAdmin, profile.permissions]);
  const visibleTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0] || null;

  // Sync dark mode class with root html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('localway-theme');
    const frame = window.requestAnimationFrame(() => {
      if (savedTheme === 'dark') setDarkMode(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('localway-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const newToast: ToastMessage = {
      id: String(Date.now()),
      type,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenAiPitchModal = (companyName: string, lead?: Lead) => {
    setAiPitchData({ isOpen: true, companyName, lead });
  };

  const handleOpenAiReviewModal = (companyName: string, reviewerName: string, reviewText: string) => {
    setAiReviewData({ isOpen: true, companyName, reviewerName, reviewText });
  };

  const handleLogout = async () => {
    if (!supabase) {
      showToast(supabaseConfigurationError(), 'error');
      return;
    }

    setIsLoggingOut(true);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      setIsLoggingOut(false);
      showToast('Não foi possível sair da conta. Tente novamente.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf8ff] dark:bg-[#0a0e27] text-[#1a1b22] dark:text-[#f8f7ff] transition-colors duration-300">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={visibleTab || 'dashboard'}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSupport={() => setShowSupportModal(true)}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
        allowedTabs={allowedTabs}
      />

      {/* Main Layout Area */}
      <div className="lg:ml-[280px] flex flex-col min-h-screen transition-all">
        {/* Sticky Header */}
        <Header
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onOpenSupport={() => setShowSupportModal(true)}
          onSwitchAccount={() => void handleLogout()}
          isSwitchingAccount={isLoggingOut}
        />

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {!allowedTabs.length && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              Seu perfil ainda não possui módulos liberados. Fale com o administrador.
            </div>
          )}
          {visibleTab && <>
          {visibleTab === 'dashboard' && (
            <DashboardView
              setActiveTab={setActiveTab}
              onShowToast={showToast}
            />
          )}

          {visibleTab === 'analises' && (
            <AnalisesView
              onShowToast={showToast}
              onOpenAiReviewModal={handleOpenAiReviewModal}
            />
          )}

          {visibleTab === 'mapa' && <HeatmapView onShowToast={showToast} />}

          {visibleTab === 'raiox' && (
            <RaioXView
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
            />
          )}

          {visibleTab === 'prospeccao' && (
            <ProspectingView
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
            />
          )}

          {visibleTab === 'followup' && (
            <FollowUpView
              onShowToast={showToast}
            />
          )}

          {visibleTab === 'crm' && (
            <CrmView
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
            />
          )}

          {visibleTab === 'propostas' && <PropostasView onShowToast={showToast} />}

          {visibleTab === 'servicos' && <ServicosView onShowToast={showToast} />}

          {visibleTab === 'equipe' && <EquipeView onShowToast={showToast} />}

          {visibleTab === 'avaliacoes' && (
            <AvaliacoesView
              onShowToast={showToast}
              onOpenAiReviewModal={handleOpenAiReviewModal}
            />
          )}

          {visibleTab === 'admin' && <AdminView onShowToast={showToast} />}
          </>}
        </main>
      </div>

      {/* Global Toast Feedback System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Modals */}
      {aiPitchData.isOpen && (
          <AiPitchModal
            companyName={aiPitchData.companyName}
            lead={aiPitchData.lead}
            onClose={() => setAiPitchData({ isOpen: false, companyName: '' })}
          onShowToast={showToast}
        />
      )}

      {aiReviewData.isOpen && (
        <AiReviewModal
          companyName={aiReviewData.companyName}
          reviewerName={aiReviewData.reviewerName}
          reviewText={aiReviewData.reviewText}
          onClose={() =>
            setAiReviewData({
              isOpen: false,
              companyName: '',
              reviewerName: '',
              reviewText: '',
            })
          }
          onShowToast={showToast}
        />
      )}

      {showSupportModal && (
        <SupportModal
          onClose={() => setShowSupportModal(false)}
          onShowToast={showToast}
        />
      )}
    </div>
  );
}
