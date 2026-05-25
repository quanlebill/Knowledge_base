import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Role, Industry, TenantContext, User, Environment, KnowledgeDocument } from './types';
import { useAuth } from './lib/AuthProvider';
import { mockGet, setApiRole } from './lib/mockApi';

interface AppStateContextType {
  role: Role;
  setRole: (role: Role) => void;
  industry: Industry;
  setIndustry: (industry: Industry) => void;
  tenant: TenantContext;
  setTenant: (tenant: Partial<TenantContext>) => void;
  user: User;
  isExpertMode: boolean;
  setIsExpertMode: (val: boolean) => void;

  /* Navigation routing — single source of truth */
  activeModule: string;
  setActiveModule: (id: string) => void;
  subTab: Record<string, string>;
  setSubTab: (moduleId: string, subId: string) => void;
  getSubTab: (moduleId: string, fallback?: string) => string | undefined;

  /* Navigation imperatives */
  navigate: (moduleId: string, subId?: string) => void;

  /* Knowledge Documents State */
  documents: KnowledgeDocument[];
  docsLoading: boolean;
  addDocument: (doc: Omit<KnowledgeDocument, 'id' | 'status' | 'version' | 'lastUpdated'>) => void;
  updateDocument: (id: string, updates: Partial<KnowledgeDocument>) => void;
  deleteDocument: (id: string) => void;

  /* Pending sidebar action (e.g. ACTION_INGEST, ACTION_WAREHOUSE) */
  pendingAction: string | null;
  setPendingAction: (action: string | null) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

/* ─── URL hash helpers ─────────────────────────────────────────────── */
const parseHash = (): { module: string; sub?: string } => {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '');
  if (!raw) return { module: 'dashboard' };
  const [module, sub] = raw.split('/');
  return { module: module || 'dashboard', sub: sub || undefined };
};

const writeHash = (module: string, sub?: string) => {
  if (typeof window === 'undefined') return;
  const next = sub ? `#${module}/${sub}` : `#${module}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', window.location.search + next);
  }
};

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<Role>('AI_ENGINEER');
  useEffect(() => { setApiRole(role); }, [role]);
  const [industry, setIndustry] = useState<Industry>('GENERAL');
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [tenant, setTenantState] = useState<TenantContext>({
    organization: 'Global Corp',
    workspace: 'Engineering Alpha',
    project: 'Nexus-7',
    environment: 'PROD',
  });

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  /* Load documents from HTTP mock server; fall back to empty list if offline */
  useEffect(() => {
    mockGet<KnowledgeDocument[]>('/api/data/documents').then((data) => {
      if (data && data.length > 0) {
        setDocuments(data);
      }
    }).catch(() => {
      // server offline — documents stay empty, UI handles gracefully
    }).finally(() => {
      setDocsLoading(false);
    });
  }, []);

  const addDocument = useCallback((doc: Omit<KnowledgeDocument, 'id' | 'status' | 'version' | 'lastUpdated'>) => {
    const newDoc: KnowledgeDocument = {
      ...doc,
      id: `d-${Math.floor(Math.random() * 900) + 100}`,
      status: 'PUBLISHED',
      version: 'v1.0',
      lastUpdated: '2026-05-24',
    };
    if (!newDoc.metadata.language) newDoc.metadata.language = 'English';
    setDocuments(prev => [newDoc, ...prev]);
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  }, []);

  const updateDocument = useCallback((id: string, updates: Partial<KnowledgeDocument>) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id !== id) return doc;
      return {
        ...doc,
        ...updates,
        metadata: { ...doc.metadata, ...(updates.metadata || {}) },
        lastUpdated: 'Just now',
      };
    }));
  }, []);

  const { user: authUser } = useAuth();
  const user: User = {
    id:    authUser?.id    ?? 'u_anon',
    name:  authUser?.name  ?? authUser?.email ?? 'User',
    email: authUser?.email ?? '',
    role:  (authUser?.roles?.find(r =>
      ['PLATFORM_ADMIN','AI_ENGINEER','BUSINESS_OPERATOR','EXECUTIVE_VIEWER'].includes(r.toUpperCase())
    )?.toUpperCase() as Role) ?? 'AI_ENGINEER',
  };

  const initial = parseHash();
  const [activeModule, _setActiveModule] = useState<string>(initial.module);
  const [subTab, _setSubTabState] = useState<Record<string, string>>(
    initial.sub ? { [initial.module]: initial.sub } : {},
  );

  const setActiveModule = useCallback((id: string) => { _setActiveModule(id); }, []);

  const setSubTab = useCallback((moduleId: string, subId: string) => {
    _setSubTabState(prev => ({ ...prev, [moduleId]: subId }));
  }, []);

  const getSubTab = useCallback(
    (moduleId: string, fallback?: string) => subTab[moduleId] ?? fallback,
    [subTab],
  );

  const navigate = useCallback((moduleId: string, subId?: string) => {
    _setActiveModule(moduleId);
    if (subId) _setSubTabState(prev => ({ ...prev, [moduleId]: subId }));
  }, []);

  useEffect(() => {
    writeHash(activeModule, subTab[activeModule]);
  }, [activeModule, subTab]);

  useEffect(() => {
    const onHashChange = () => {
      const { module, sub } = parseHash();
      _setActiveModule(module);
      if (sub) _setSubTabState(prev => ({ ...prev, [module]: sub }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setTenant = (newTenant: Partial<TenantContext>) => {
    setTenantState(prev => ({ ...prev, ...newTenant }));
  };

  return (
    <AppStateContext.Provider
      value={{
        role, setRole, industry, setIndustry,
        tenant, setTenant, user, isExpertMode, setIsExpertMode,
        activeModule, setActiveModule,
        subTab, setSubTab, getSubTab, navigate,
        documents, docsLoading, addDocument, updateDocument, deleteDocument,
        pendingAction, setPendingAction,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
};
