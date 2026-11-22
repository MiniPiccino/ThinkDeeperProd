import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/app/providers";
import { fetchBillingStatus } from "@/lib/api";

export function useBillingStatus() {
  const { user, loading: authLoading } = useAuth();
  const query = useQuery({
    queryKey: ["billing-status", user?.id],
    queryFn: fetchBillingStatus,
    enabled: Boolean(user) && !authLoading,
    staleTime: 0,
    retry: false,
  });
  return { user, authLoading, ...query };
}
