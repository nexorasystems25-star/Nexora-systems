import AppLayout from "../../components/app-layout";

// ============================================================================
// DASHBOARD LAYOUT
// ============================================================================
// Wraps all dashboard pages with the app shell
// ============================================================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
