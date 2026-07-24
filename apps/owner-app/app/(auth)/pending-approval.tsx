import { Redirect } from 'expo-router';

export default function PendingApprovalRoute() {
  return <Redirect href="/(auth)/login" />;
}
