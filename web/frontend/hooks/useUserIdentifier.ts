import { useAuth } from '@/app/providers';

export function useUserIdentifier(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}
