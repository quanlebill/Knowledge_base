import { DeploymentRecord, EnvironmentState } from '../types/deployment';

export const MOCK_DEPLOYMENTS: DeploymentRecord[] = [
  {
    id: 'DEP-9912',
    name: 'Support Agent V1.4 Promotion',
    type: 'AGENT',
    env: 'PROD',
    status: 'SUCCESS',
    version: 'v1.4.2',
    startedAt: '2h ago',
    duration: '4m 12s',
    owner: 'Sarah Connor',
    approver: 'Platform Admin',
    affectedAgents: ['agt-001'],
    affectedKBs: ['kb-corp-v4'],
    riskScore: 12
  },
  {
    id: 'DEP-9915',
    name: 'Corporate Policy KB Sync',
    type: 'KB',
    env: 'UAT',
    status: 'VALIDATING',
    version: 'kb-v5.0-alpha',
    startedAt: '10m ago',
    duration: '2m 15s (current)',
    owner: 'Data Eng Team',
    affectedAgents: ['agt-001', 'agt-002'],
    affectedKBs: ['kb-corp-v5'],
    riskScore: 45
  },
  {
    id: 'DEP-9918',
    name: 'Federal Compliance Patch',
    type: 'POLICY',
    env: 'PROD',
    status: 'WAITING_APPROVAL',
    version: 'policy-v2.1',
    startedAt: '1h ago',
    duration: '--',
    owner: 'Compliance Team',
    affectedAgents: ['agt-002'],
    affectedKBs: [],
    riskScore: 8
  },
  {
    id: 'DEP-9905',
    name: 'Infrastructure Scale-Up',
    type: 'SOLUTION',
    env: 'DEV',
    status: 'FAILED',
    version: 'infra-3.2',
    startedAt: '5h ago',
    duration: '12m 40s',
    owner: 'Elena Rigby',
    affectedAgents: ['all'],
    affectedKBs: ['all'],
    riskScore: 92,
    drifts: ['Environment Variable Mismatch', 'Secret Token Expired']
  }
];

export const MOCK_ENVIRONMENTS: EnvironmentState[] = [
  {
    name: 'DEV',
    status: 'HEALTHY',
    agentCount: 42,
    kbCount: 12,
    lastDeployment: '15m ago',
    runtimeVersion: 'r2025.04.1',
    healthScore: 99,
    driftCount: 0
  },
  {
    name: 'UAT',
    status: 'DEGRADED',
    agentCount: 12,
    kbCount: 4,
    lastDeployment: '2h ago',
    runtimeVersion: 'r2025.03.8',
    healthScore: 78,
    driftCount: 4
  },
  {
    name: 'PROD',
    status: 'HEALTHY',
    agentCount: 8,
    kbCount: 2,
    lastDeployment: '2h ago',
    runtimeVersion: 'r2025.03.5',
    healthScore: 94,
    driftCount: 8
  }
];
