export type AgentRole = 
  | "chief-executive"
  | "coo"
  | "cpo"
  | "cto"
  | "engineering-lead"
  | "product-manager"
  | "developer";

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  capabilities: string[];
  reportsTo?: string;
}

export const AI_HIERARCHY: Agent[] = [
  {
    id: "ceo-001",
    role: "chief-executive",
    name: "Chief Executive Agent",
    capabilities: ["strategy", "governance", "resource-allocation"],
  },
  {
    id: "coo-001",
    role: "coo",
    name: "Chief Operating Officer Agent",
    capabilities: ["operations", "process-optimization", "monitoring"],
    reportsTo: "ceo-001",
  },
  {
    id: "cpo-001",
    role: "cpo",
    name: "Chief Product Officer Agent",
    capabilities: ["product-strategy", "roadmap", "user-research"],
    reportsTo: "ceo-001",
  },
  {
    id: "cto-001",
    role: "cto",
    name: "Chief Technology Officer Agent",
    capabilities: ["architecture", "technology-strategy", "security"],
    reportsTo: "ceo-001",
  },
];

export function getAgentById(id: string): Agent | undefined {
  return AI_HIERARCHY.find(agent => agent.id === id);
}

export function getAgentsByRole(role: AgentRole): Agent[] {
  return AI_HIERARCHY.filter(agent => agent.role === role);
}

export function getDirectReports(agentId: string): Agent[] {
  return AI_HIERARCHY.filter(agent => agent.reportsTo === agentId);
}
