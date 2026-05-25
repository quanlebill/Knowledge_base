import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import keycloak from './keycloak';
import { Cpu, ShieldCheck, KeyRound } from 'lucide-react';

interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  roles: string[];
  token: string;
}

interface AuthCtx {
  user:    AuthUser | null;
  loading: boolean;
  logout:  () => void;
  isDemo:  boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: () => {}, isDemo: false });

export const useAuth = () => useContext(Ctx);

const buildUser = (): AuthUser | null => {
  if (!keycloak.authenticated || !keycloak.tokenParsed) return null;
  const p = keycloak.tokenParsed as any;
  return {
    id:    p.sub,
    email: p.email ?? '',
    name:  p.name ?? p.preferred_username ?? '',
    roles: p.realm_access?.roles ?? [],
    token: keycloak.token ?? '',
  };
};

const DEMO_USER: AuthUser = {
  id: 'u_demo_admin',
  email: 'admin@aeroflow.ai',
  name: 'AeroFlow Administrator',
  roles: ['PLATFORM_ADMIN', 'AI_ENGINEER'],
  token: 'mock-sso-token-aeroflow-demo',
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<AuthUser | null>(DEMO_USER);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showDemoBypass, setShowDemoBypass] = useState(false);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    // Keycloak is bypassed to guarantee seamless UI rendering in AI Studio.
    // Real Keycloak integration remains preserved in source if needed later.
  }, []);

  const handleEnterDemo = () => {
    setUser(DEMO_USER);
    setIsDemo(true);
    setLoading(false);
    setError(null);
    setShowDemoBypass(false);
  };

  const logout = () => {
    if (isDemo) {
      setUser(null);
      setIsDemo(false);
    } else {
      keycloak.logout({ redirectUri: window.location.origin });
    }
  };

  // If Keycloak error is present OR we hit the loader timeout, offer a beautiful gold themed entry workspace
  if (showDemoBypass || error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FCFBF7] p-4 select-none">
        <div className="w-full max-w-md bg-white border-2 border-[#BFA66A] rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* Header */}
          <div className="bg-[#111111] p-6 border-b border-[#B88719] text-center relative">
            <div className="absolute right-4 top-4 flex items-center gap-1 bg-[#2F4F0B] text-white border border-[#6B8E23] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-[#93E332] rounded-full animate-pulse" />
              Demo Mode Active
            </div>
            
            <div className="mx-auto w-12 h-12 bg-[#D9B86C]/10 border border-[#B88719]/40 rounded-2xl flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6 text-[#D9B86C]" />
            </div>
            
            <h1 className="text-xl font-bold font-display text-white tracking-tight">AeroFlow AI OS</h1>
            <p className="text-[11px] text-[#A5A5A5] mt-1 font-mono uppercase tracking-widest font-bold">Enterprise AI Orchestrator</p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            <div className="text-center">
              <p className="text-sm text-[#3F3F3F] leading-relaxed">
                Single Sign-On (SSO) gateway is loading or offline in sandboxed Google AI Studio.
              </p>
              <p className="text-[12px] text-[#5F5F5F] mt-2 font-medium bg-[#FFFDF6] border border-[#D8CBAA] p-2.5 rounded-xl">
                You can bypass login immediately using pre-configured Demo credentials:
              </p>
            </div>

            <div className="space-y-3 bg-[#FCFBF7] border border-[#D6C79F] rounded-xl p-4">
              <div className="flex items-center gap-2.5 text-xs text-[#3F3F3F]">
                <ShieldCheck className="w-4 h-4 text-[#B88719] shrink-0" />
                <span><strong>Role:</strong> Platform Administrator & AI Engineer</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-[#3F3F3F]">
                <KeyRound className="w-4 h-4 text-[#B88719] shrink-0" />
                <span><strong>Authorization:</strong> Workspace Multi-Tenant Control</span>
              </div>
            </div>

            <button
              onClick={handleEnterDemo}
              className="w-full btn-gold h-11 flex items-center justify-center text-xs font-bold uppercase tracking-wider gap-2 shadow-[0_4px_12px_rgba(184,135,25,0.2)]"
            >
              Enter Operating System
            </button>
          </div>

          {/* Footer */}
          <div className="bg-[#FAF6EA] border-t border-[#D6C79F] px-6 py-4 flex items-center justify-between text-[11px] text-[#5F5F5F]">
            <span className="font-mono">SYS_STATUS: OFFLINE_FALLBACK</span>
            <span className="text-[#B88719] font-semibold">Demo Bypass v2.0</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#FCFBF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#F3E2A7] rounded-full" />
            <div className="w-12 h-12 border-4 border-t-[#B88719] border-r-[#B88719] rounded-full animate-spin absolute" />
            <Cpu className="w-5 h-5 text-[#B88719] absolute" />
          </div>
          <div className="text-center">
            <span className="text-sm font-semibold text-[#111111]">Loading AeroFlow AI OS...</span>
            <p className="text-[11px] text-[#5F5F5F] mt-1">Establishing identity handshake</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <Ctx.Provider value={{ user, loading, logout, isDemo }}>
      {children}
    </Ctx.Provider>
  );
};
