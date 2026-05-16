import React, { useState } from 'react';
import { SettingsLayout, SettingsSection } from './SettingsLayout';
import { OverviewSection } from './OverviewSection';
import { OrganizationSection } from './OrganizationSection';
import { IAMSection } from './IAMSection';
import { AuthSection } from './AuthSection';
import { AIInfrastructureSection } from './AIInfrastructureSection';
import { InfrastructureSection } from './InfrastructureSection';
import { StorageSection } from './StorageSection';
import { SecretsSection } from './SecretsSection';
import { SecurityComplianceSection } from './SecurityComplianceSection';
import { BillingQuotasSection } from './BillingQuotasSection';
import { APISection } from './APISection';
import { AdvancedPlatformSection } from './AdvancedPlatformSection';

const SettingsView = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('OVERVIEW');

  const renderSection = () => {
    switch (activeSection) {
      case 'OVERVIEW':
        return <OverviewSection />;
      case 'ORGANIZATION':
        return <OrganizationSection />;
      case 'IAM':
        return <IAMSection />;
      case 'AUTH':
        return <AuthSection />;
      case 'AI_PROVIDERS':
        return <AIInfrastructureSection />;
      case 'INFRASTRUCTURE':
        return <InfrastructureSection />;
      case 'STORAGE':
        return <StorageSection />;
      case 'SECRETS':
        return <SecretsSection />;
      case 'SECURITY':
        return <SecurityComplianceSection />;
      case 'BILLING':
        return <BillingQuotasSection />;
      case 'API':
        return <APISection />;
      case 'ADVANCED':
        return <AdvancedPlatformSection />;
      default:
        return (
          <div className="h-full flex items-center justify-center text-slate-500 font-display italic">
            Module "{activeSection}" is initializing...
          </div>
        );
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <SettingsLayout activeSection={activeSection} onSectionChange={setActiveSection}>
        {renderSection()}
      </SettingsLayout>
    </div>
  );
};

export default SettingsView;
