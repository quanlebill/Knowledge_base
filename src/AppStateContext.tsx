import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Role, Industry, TenantContext, User, Environment } from './types';

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
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<Role>('AI_ENGINEER');
  const [industry, setIndustry] = useState<Industry>('GENERAL');
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [tenant, setTenantState] = useState<TenantContext>({
    organization: 'Global Corp',
    workspace: 'Engineering Alpha',
    project: 'Nexus-7',
    environment: 'PROD',
  });

  const [user] = useState<User>({
    id: 'u_123',
    name: 'Alex Rivera',
    email: 'alex.rivera@globalcorp.ai',
    role: 'AI_ENGINEER',
  });

  const setTenant = (newTenant: Partial<TenantContext>) => {
    setTenantState(prev => ({ ...prev, ...newTenant }));
  };

  return (
    <AppStateContext.Provider value={{ 
      role, 
      setRole, 
      industry, 
      setIndustry, 
      tenant, 
      setTenant, 
      user,
      isExpertMode,
      setIsExpertMode
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
};
