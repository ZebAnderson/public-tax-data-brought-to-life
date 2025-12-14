'use client';

/**
 * TaxAtlas Providers
 * React Query, Ant Design, and other providers
 */

import React, { useState, createContext, useContext, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp, unstableSetRender } from 'antd';
import { antdTheme } from '@/styles/tokens';
import type { SourceReference, UserAssumptions, PayType } from '@/types';

// Ant Design React 19 compatibility:
// Avoid compatibility warnings and ensure message/modal/notification render correctly.
const reactMajorVersion = Number.parseInt(React.version.split('.')[0] ?? '0', 10);
if (reactMajorVersion >= 19) {
  const roots = new WeakMap<Element | DocumentFragment, Root>();
  unstableSetRender((node, container) => {
    let root = roots.get(container);
    if (!root) {
      root = createRoot(container);
      roots.set(container, root);
    }
    root.render(node);
    return async () => {
      root?.unmount();
      roots.delete(container);
    };
  });
}

// ============================================================================
// Source Drawer Context
// ============================================================================

interface SourceDrawerContextType {
  isOpen: boolean;
  source: SourceReference | null;
  openSource: (source: SourceReference) => void;
  closeSource: () => void;
}

const SourceDrawerContext = createContext<SourceDrawerContextType | null>(null);

export function useSourceDrawer() {
  const context = useContext(SourceDrawerContext);
  if (!context) {
    throw new Error('useSourceDrawer must be used within Providers');
  }
  return context;
}

// ============================================================================
// Presence Mode Context
// ============================================================================

type PresenceModeOption = 'live' | 'work' | 'both';

interface PresenceModeContextType {
  mode: PresenceModeOption;
  setMode: (mode: PresenceModeOption) => void;
  apiMode: string;
}

const PresenceModeContext = createContext<PresenceModeContextType | null>(null);

export function usePresenceMode() {
  const context = useContext(PresenceModeContext);
  if (!context) {
    throw new Error('usePresenceMode must be used within Providers');
  }
  return context;
}

// ============================================================================
// User Assumptions Context
// ============================================================================

interface UserAssumptionsContextType {
  assumptions: UserAssumptions;
  setPayType: (payType: PayType) => void;
  updateAssumptions: (patch: Partial<UserAssumptions>) => void;
  resetAssumptions: () => void;
}

const UserAssumptionsContext = createContext<UserAssumptionsContextType | null>(null);

export function useUserAssumptions() {
  const context = useContext(UserAssumptionsContext);
  if (!context) {
    throw new Error('useUserAssumptions must be used within Providers');
  }
  return context;
}

const DEFAULT_ASSUMPTIONS: UserAssumptions = {
  payType: 'mixed_unsure',
  annualW2WageIncome: null,
  annual1099Income: null,
  annualHouseholdIncome: null,
  householdSize: null,
  showEmployerSideTaxes: false,
  annualTaxableSpending: null,
};

// ============================================================================
// Providers Component
// ============================================================================

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // React Query client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Source drawer state
  const [sourceDrawerState, setSourceDrawerState] = useState<{
    isOpen: boolean;
    source: SourceReference | null;
  }>({
    isOpen: false,
    source: null,
  });

  const sourceDrawerValue: SourceDrawerContextType = {
    isOpen: sourceDrawerState.isOpen,
    source: sourceDrawerState.source,
    openSource: (source) => setSourceDrawerState({ isOpen: true, source }),
    closeSource: () => setSourceDrawerState({ isOpen: false, source: null }),
  };

  // Presence mode state
  const [presenceMode, setPresenceMode] = useState<PresenceModeOption>('both');

  const presenceModeValue: PresenceModeContextType = {
    mode: presenceMode,
    setMode: setPresenceMode,
    apiMode: presenceMode === 'both' ? 'live_work' : presenceMode,
  };

  const [assumptions, setAssumptions] = useState<UserAssumptions>(() => {
    try {
      const raw = globalThis?.localStorage?.getItem('taxatlas:userAssumptions');
      if (!raw) return DEFAULT_ASSUMPTIONS;
      const parsed = JSON.parse(raw) as Partial<UserAssumptions> | null;
      if (!parsed) return DEFAULT_ASSUMPTIONS;
      return { ...DEFAULT_ASSUMPTIONS, ...parsed };
    } catch {
      return DEFAULT_ASSUMPTIONS;
    }
  });

  const updateAssumptions = (patch: Partial<UserAssumptions>) => {
    setAssumptions((prev) => {
      const next = { ...prev, ...patch };
      try {
        globalThis?.localStorage?.setItem('taxatlas:userAssumptions', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setPayType = (payType: PayType) => {
    setAssumptions((prev) => {
      const next: UserAssumptions = {
        ...prev,
        payType,
        showEmployerSideTaxes:
          payType === 'w2' ? true : prev.showEmployerSideTaxes,
      };
      try {
        globalThis?.localStorage?.setItem('taxatlas:userAssumptions', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const resetAssumptions = () => {
    updateAssumptions(DEFAULT_ASSUMPTIONS);
  };

  const userAssumptionsValue: UserAssumptionsContextType = {
    assumptions,
    setPayType,
    updateAssumptions,
    resetAssumptions,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antdTheme}>
        <AntApp>
          <SourceDrawerContext.Provider value={sourceDrawerValue}>
            <PresenceModeContext.Provider value={presenceModeValue}>
              <UserAssumptionsContext.Provider value={userAssumptionsValue}>
                {children}
              </UserAssumptionsContext.Provider>
            </PresenceModeContext.Provider>
          </SourceDrawerContext.Provider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
