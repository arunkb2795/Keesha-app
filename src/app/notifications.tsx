import { DashboardEmptyState, DashboardHeading, DashboardScreen } from '@/components/dashboard/dashboard-ui';

export default function NotificationsScreen() {
  return (
    <DashboardScreen>
      <DashboardHeading title="Notifications" />
      <DashboardEmptyState icon="bell" title="No new notifications"
        message="You’re all caught up. Check back here for new notifications." />
    </DashboardScreen>
  );
}
