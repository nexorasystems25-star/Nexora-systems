export const rolePolicies = {
  super_admin: {
    label: "Super Administrator",
    description: "Complete organisational control, including users and security.",
    permissions: ["*"],
  },
  senior_pastor: {
    label: "Senior Pastor",
    description: "Church-wide ministry oversight with confidential pastoral access.",
    permissions: ["dashboard.read", "members.read", "members.create", "members.update", "families.read", "families.manage", "attendance.read", "attendance.manage", "ministries.read", "ministries.manage", "leadership.read", "leadership.manage", "volunteers.read", "volunteers.manage", "events.read", "events.manage", "care.read", "care.confidential.read", "care.manage", "welfare.read", "welfare.manage", "welfare.approve", "payroll.read", "records.read", "records.manage", "records.issue", "archive.read", "archive.manage", "reminders.read", "reminders.manage", "communication.read", "reports.read"],
  },
  church_admin: {
    label: "Church Administrator",
    description: "Day-to-day people, service, ministry and event administration.",
    permissions: ["dashboard.read", "members.read", "members.create", "members.update", "members.import", "families.read", "families.manage", "attendance.read", "attendance.manage", "ministries.read", "ministries.manage", "leadership.read", "volunteers.read", "volunteers.manage", "events.read", "events.manage", "care.read", "welfare.read", "welfare.manage", "payroll.read", "payroll.manage", "records.read", "records.manage", "records.issue", "archive.read", "archive.manage", "reminders.read", "reminders.manage", "communication.read", "communication.manage", "reports.read", "reports.export"],
  },
  membership_officer: {
    label: "Membership Officer",
    description: "Member records, visitor conversion and attendance operations.",
    permissions: ["dashboard.read", "members.read", "members.create", "members.update", "members.import", "families.read", "families.manage", "attendance.read", "attendance.manage", "ministries.read", "leadership.read", "volunteers.read", "volunteers.manage", "care.read", "records.read", "records.manage", "records.issue", "archive.read", "reminders.read", "reminders.manage", "reports.read"],
  },
  finance_officer: {
    label: "Finance Officer",
    description: "Records collections and expenses and requests controlled reversals.",
    permissions: ["dashboard.read", "members.read", "finance.read", "finance.create", "finance.reverse", "welfare.read", "payroll.read", "payroll.manage", "reports.read", "reports.export"],
  },
  finance_approver: {
    label: "Finance Approver",
    description: "Independently reviews finance entries recorded by another officer.",
    permissions: ["dashboard.read", "finance.read", "finance.approve", "welfare.read", "welfare.approve", "payroll.read", "payroll.approve", "reports.read", "reports.export"],
  },
  ministry_leader: {
    label: "Ministry Leader",
    description: "Assigned ministry membership, attendance and communication.",
    permissions: ["dashboard.read", "members.read", "attendance.read", "attendance.manage", "ministries.read", "leadership.read", "volunteers.read", "volunteers.manage", "events.read", "records.read", "archive.read", "archive.manage", "communication.read"],
  },
  auditor: {
    label: "Auditor",
    description: "Read-only financial, operational and audit reporting.",
    permissions: ["dashboard.read", "members.read", "attendance.read", "finance.read", "welfare.read", "payroll.read", "records.read", "archive.read", "reports.read", "reports.export"],
  },
  member: {
    label: "Church Member",
    description: "Personal self-service access to the member portal only.",
    permissions: ["portal.read", "portal.profile.update"],
  },
} as const;

export type RoleKey = keyof typeof rolePolicies;

export function hasPermission(role: RoleKey, permission: string) {
  const permissions = rolePolicies[role]?.permissions as readonly string[] | undefined;
  return Boolean(permissions?.includes("*") || permissions?.includes(permission));
}

export const defaultRole: RoleKey = "ministry_leader";
