export type Section =
  | "Dashboard"
  | "Members"
  | "Families"
  | "Attendance"
  | "Finance"
  | "Welfare Finance"
  | "Payroll"
  | "Records Studio"
  | "Media Archive"
  | "Reminders"
  | "Ministries"
  | "Leadership"
  | "Volunteers"
  | "Events"
  | "Care"
  | "Communication"
  | "Reports"
  | "Administration";

export type Member = {
  name: string;
  initials: string;
  id: string;
  group: string;
  phone: string;
  email?: string;
  gender?: string;
  birthDate?: string;
  maritalStatus?: string;
  weddingDate?: string;
  address?: string;
  hometown?: string;
  occupation?: string;
  membershipType?: string;
  baptismStatus?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  notes?: string;
  profilePhotoUrl?: string;
  status: "Active" | "New convert" | "Follow-up";
  joined: string;
};

export type ModuleDefinition = {
  label: Section;
  icon: string;
  description: string;
  permission: string;
  notificationCount?: number;
};

export const modules: ModuleDefinition[] = [
  { label: "Dashboard", icon: "⌂", description: "Executive ministry overview", permission: "dashboard.read" },
  { label: "Members", icon: "♙", description: "People, families and membership", permission: "members.read" },
  { label: "Families", icon: "⌂", description: "Households and relationships", permission: "families.read" },
  { label: "Attendance", icon: "✓", description: "Services, groups and check-in", permission: "attendance.read" },
  { label: "Finance", icon: "₵", description: "Giving, collections and expenses", permission: "finance.read" },
  { label: "Welfare Finance", icon: "♡", description: "Assistance requests and controlled disbursements", permission: "welfare.read" },
  { label: "Payroll", icon: "▤", description: "Staff records, pay runs and approvals", permission: "payroll.read" },
  { label: "Records Studio", icon: "▧", description: "Forms, certificates and member ID cards", permission: "records.read" },
  { label: "Media Archive", icon: "◉", description: "Documents, sermons, audio, video and gallery", permission: "archive.read" },
  { label: "Reminders", icon: "◫", description: "Birthdays, anniversaries and prepared outreach", permission: "reminders.read" },
  { label: "Ministries", icon: "◇", description: "Departments, groups and fellowships", permission: "ministries.read" },
  { label: "Leadership", icon: "♜", description: "Appointments and ministry oversight", permission: "leadership.read" },
  { label: "Volunteers", icon: "♧", description: "Skills, availability and service teams", permission: "volunteers.read" },
  { label: "Events", icon: "□", description: "Calendar and service planning", permission: "events.read" },
  { label: "Care", icon: "♡", description: "Welfare and pastoral follow-up", permission: "care.read", notificationCount: 4 },
  { label: "Communication", icon: "✦", description: "Campaigns and announcements", permission: "communication.read" },
  { label: "Reports", icon: "↗", description: "Operational and ministry insights", permission: "reports.read" },
  { label: "Administration", icon: "⚙", description: "Users, roles and security", permission: "administration.manage" },
];

export const seedMembers: Member[] = [
  { name: "Akosua Mensah", initials: "AM", id: "CH-0241", group: "Women’s Ministry", phone: "024 000 1842", status: "Active", joined: "14 Feb 2022" },
  { name: "Kwame Owusu", initials: "KO", id: "CH-0318", group: "Men’s Ministry", phone: "055 410 8821", status: "Active", joined: "08 Jul 2023" },
  { name: "Abena Boateng", initials: "AB", id: "CH-0397", group: "Youth Ministry", phone: "020 771 1904", status: "New convert", joined: "21 Jul 2026" },
  { name: "Kofi Asare", initials: "KA", id: "CH-0374", group: "Choir", phone: "027 120 3301", status: "Follow-up", joined: "11 Jun 2026" },
  { name: "Esi Addo", initials: "EA", id: "CH-0355", group: "Children’s Ministry", phone: "054 662 1172", status: "Active", joined: "03 Jan 2025" },
];

export const upcomingEvents = [
  { date: "02", month: "AUG", title: "Sunday Celebration Service", meta: "8:30 AM · Main Auditorium", color: "blue" },
  { date: "05", month: "AUG", title: "Midweek Bible Teaching", meta: "6:00 PM · Chapel", color: "gold" },
  { date: "09", month: "AUG", title: "Youth Empowerment Summit", meta: "10:00 AM · Main Auditorium", color: "green" },
];

export type Household = {
  id: number;
  code: string;
  name: string;
  address: string;
  primaryPhone: string;
  campus: string;
  pastoralZone: string;
  status: string;
  memberCount: number;
  headName?: string;
};

export type OrganisationUnit = {
  id: number;
  name: string;
  type: "Ministry" | "Department" | "Fellowship";
  leaderName: string;
  memberCount: number;
  meetingSchedule: string;
  campus: string;
  status: string;
};

export type AttendanceRecord = {
  id: number;
  memberId?: number | null;
  churchId?: string;
  name: string;
  initials: string;
  personType: "Member" | "Visitor";
  attendanceStatus: "Present" | "Late" | "Excused";
  checkInMethod: "Manual" | "QR" | "Mobile";
  checkedInAt: string;
};

export type AttendanceSession = {
  id: number;
  code: string;
  title: string;
  serviceType: string;
  serviceDate: string;
  startTime: string;
  campus: string;
  venue: string;
  status: "Scheduled" | "Open" | "Completed";
  expectedCount: number;
  memberCount: number;
  visitorCount: number;
  records: AttendanceRecord[];
};

export type FinanceFund = {
  id: number;
  name: string;
  code: string;
  purpose: string;
  status: string;
  income: number;
  expenses: number;
  balance: number;
};

export type FinanceTransaction = {
  id: number;
  reference: string;
  type: "Income" | "Expense";
  category: string;
  fundId: number;
  fundName: string;
  amount: number;
  transactionDate: string;
  paymentMethod: string;
  description: string;
  payerPayee?: string;
  receiptNumber?: string;
  status: "Pending" | "Approved" | "Rejected";
  recordedBy: string;
  recordedByUserId?: number | null;
  recordedByEmail?: string | null;
  approvedBy?: string;
  approvedByUserId?: number | null;
  approvedByEmail?: string | null;
  approvedAt?: string | null;
  decisionReason?: string | null;
  reversalOfId?: number | null;
  reversalReason?: string | null;
  createdAt: string;
};

export type ChurchEvent = {
  id: number;
  code: string;
  title: string;
  eventType: string;
  startDate: string;
  startTime: string;
  endTime?: string;
  campus: string;
  venue: string;
  coordinator: string;
  expectedAttendance: number;
  status: "Planning" | "Ready" | "In progress" | "Completed" | "Cancelled";
  attendanceSessionId?: number | null;
  notes?: string;
  programme: { id: number; sequence: number; title: string; owner: string; durationMinutes: number; status: string }[];
  assignments: { id: number; teamName: string; leaderName: string; requiredCount: number; confirmedCount: number; status: string }[];
};

export type CareCase = {
  id: number;
  code: string;
  memberChurchId?: string;
  personName: string;
  personPhone?: string;
  personType: "Member" | "New Convert" | "Visitor" | "Household";
  caseType: string;
  source: string;
  priority: "Urgent" | "High" | "Normal" | "Low";
  stage: string;
  assignedTo: string;
  nextActionDate?: string;
  summary: string;
  sensitiveNotes?: string;
  isConfidential: boolean;
  status: "Open" | "Resolved" | "Closed";
  createdAt: string;
  activities: { id: number; activityType: string; note: string; outcome?: string; completedBy: string; completedAt: string }[];
};
