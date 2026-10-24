import { Redirect } from 'expo-router';

import { useRole } from '@/lib/role';

export default function Index() {
  const { role, loading } = useRole();
  if (loading) return null;
  if (role === 'elder') return <Redirect href="/elder" />;
  if (role === 'guardian') return <Redirect href="/guardian" />;
  return <Redirect href="/role" />;
}
