import React, { useEffect, useState } from 'react';
import { db, getCompanyInfo, getSettings } from './db';
import type { CompanyInfo, AppSettings, NavigationSection } from './types';
import { checkIfFirstRun } from './services/demoDataService';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SetupWizard } from './components/SetupWizard';
import { LockScreen } from './components/LockScreen';

// Views
import { DashboardView } from './views/DashboardView';
import { OrdersView } from './views/OrdersView';
import { StockView } from './views/StockView';
import { ProductionView } from './views/ProductionView';
import { CatalogView } from './views/CatalogView';
import { PricingView } from './views/PricingView';
import { ClientsView } from './views/ClientsView';
import { PaymentsView } from './views/PaymentsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { BackupView } from './views/BackupView';
import { TestsView } from './views/TestsView';

export default function App() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Navigation state
  const [activeSection, setActiveSection] = useState<NavigationSection>('DASHBOARD');
  const [activeSubSection, setActiveSubSection] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Initialize and check setup/lock state
  const initApp = async () => {
    try {
      const firstRun = await checkIfFirstRun();
      setIsFirstRun(firstRun);

      if (!firstRun) {
        const [c, s] = await Promise.all([getCompanyInfo(), getSettings()]);
        if (c) setCompanyInfo(c);
        if (s) {
          setAppSettings(s);
          if (s.passwordHash) {
            // Check if locked in this session
            const wasUnlocked = sessionStorage.getItem('otm_unlocked') === 'true';
            setIsLocked(!wasUnlocked);
          } else {
            setIsLocked(false);
          }
        }
      }
    } catch (err) {
      console.error('Erreur initialisation OTM DOOR:', err);
      setIsFirstRun(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleNavigate('ORDERS', 'NEW');
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleNavigate('STOCK');
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          handleNavigate('PRODUCTION');
        } else if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          handleLock();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appSettings]);

  const handleNavigate = (section: NavigationSection, sub?: string) => {
    setActiveSection(section);
    setActiveSubSection(sub);
    setSidebarOpen(false); // Close mobile sidebar on select
  };

  const handleUnlock = () => {
    sessionStorage.setItem('otm_unlocked', 'true');
    setIsLocked(false);
  };

  const handleLock = () => {
    if (appSettings?.passwordHash) {
      sessionStorage.removeItem('otm_unlocked');
      setIsLocked(true);
    }
  };

  const handleSetupComplete = async () => {
    setIsFirstRun(false);
    await initApp();
    setActiveSection('DASHBOARD');
  };

  // Loading screen during initial IndexedDB probe
  if (isFirstRun === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span className="text-xs font-semibold tracking-wider text-slate-400">
            Démarrage d'OTM DOOR...
          </span>
        </div>
      </div>
    );
  }

  // First run Setup Wizard
  if (isFirstRun) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  // App Locked Screen
  if (isLocked && appSettings?.passwordHash) {
    return (
      <LockScreen
        companyName={companyInfo?.name || 'OTM DOOR'}
        companyLogo={companyInfo?.logo}
        onUnlock={handleUnlock}
      />
    );
  }

  // Main Application Interface
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        companyName={companyInfo?.name || 'OTM DOOR'}
        companyLogo={companyInfo?.logo}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <Header
          activeSection={activeSection}
          onNavigate={handleNavigate}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onLock={appSettings?.passwordHash ? handleLock : undefined}
          isPasswordProtected={Boolean(appSettings?.passwordHash)}
        />

        {/* Dynamic View Scroll Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeSection === 'DASHBOARD' && (
              <DashboardView onNavigate={handleNavigate} />
            )}

            {activeSection === 'ORDERS' && (
              <OrdersView subSection={activeSubSection} />
            )}

            {activeSection === 'STOCK' && (
              <StockView subSection={activeSubSection} />
            )}

            {activeSection === 'PRODUCTION' && (
              <ProductionView subSection={activeSubSection} />
            )}

            {activeSection === 'CATALOG' && (
              <CatalogView subSection={activeSubSection} />
            )}

            {activeSection === 'PRICING' && (
              <PricingView />
            )}

            {activeSection === 'CLIENTS' && (
              <ClientsView />
            )}

            {activeSection === 'PAYMENTS' && (
              <PaymentsView />
            )}

            {activeSection === 'REPORTS' && (
              <ReportsView />
            )}

            {activeSection === 'SETTINGS' && (
              <SettingsView />
            )}

            {activeSection === 'BACKUP' && (
              <BackupView />
            )}

            {activeSection === 'TESTS' && (
              <TestsView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
