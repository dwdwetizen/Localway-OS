'use client';

import React, { useState, useEffect } from 'react';
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
import { AuthGate } from '@/components/AuthGate';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals state
  const [aiPitchData, setAiPitchData] = useState<{ isOpen: boolean; companyName: string }>({
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

  // Sync dark mode class with root html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const newToast: ToastMessage = {
      id: String(Date.now()),
      type,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenAiPitchModal = (companyName: string) => {
    setAiPitchData({ isOpen: true, companyName });
  };

  const handleOpenAiReviewModal = (companyName: string, reviewerName: string, reviewText: string) => {
    setAiReviewData({ isOpen: true, companyName, reviewerName, reviewText });
  };

  return (
    <AuthGate><div className="min-h-screen bg-[#fbf8ff] dark:bg-[#0a0e27] text-[#1a1b22] dark:text-[#f8f7ff] transition-colors duration-300">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSupport={() => setShowSupportModal(true)}
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
        />

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              setActiveTab={setActiveTab}
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
            />
          )}

          {activeTab === 'analises' && (
            <AnalisesView
              onShowToast={showToast}
              onOpenAiReviewModal={handleOpenAiReviewModal}
            />
          )}

          {activeTab === 'mapa' && <HeatmapView onShowToast={showToast} />}

          {activeTab === 'raiox' && (
            <RaioXView
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
            />
          )}

          {activeTab === 'prospeccao' && (
            <ProspectingView
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
              onOpenFollowUp={() => setActiveTab('followup')}
            />
          )}

          {activeTab === 'followup' && (
            <FollowUpView
              onShowToast={showToast}
              onOpenCrm={() => setActiveTab('crm')}
            />
          )}

          {activeTab === 'crm' && (
            <CrmView
              onShowToast={showToast}
              onOpenAiPitchModal={handleOpenAiPitchModal}
            />
          )}

          {activeTab === 'propostas' && <PropostasView onShowToast={showToast} />}

          {activeTab === 'servicos' && <ServicosView onShowToast={showToast} />}

          {activeTab === 'equipe' && <EquipeView onShowToast={showToast} />}

          {activeTab === 'avaliacoes' && (
            <AvaliacoesView
              onShowToast={showToast}
              onOpenAiReviewModal={handleOpenAiReviewModal}
            />
          )}

          {activeTab === 'admin' && <AdminView onShowToast={showToast} />}
        </main>
      </div>

      {/* Global Toast Feedback System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Modals */}
      {aiPitchData.isOpen && (
        <AiPitchModal
          companyName={aiPitchData.companyName}
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
    </div></AuthGate>
  );
}
