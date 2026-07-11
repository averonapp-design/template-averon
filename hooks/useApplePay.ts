import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { averonApi, ApplePaymentStatus } from "@/services/averon";

export function useApplePay(apiKey: string | null, alunoToken?: string | null) {
  const [status, setStatus] = useState<ApplePaymentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const isSupported = Platform.OS === "ios";

  const enabled = isSupported && (status?.enabled === true);
  const produtos = status?.produtos ?? [];
  // Site-wide checkout fallback: prefer checkout_url, then loja_url
  const siteCheckoutUrl = status?.checkout_url ?? status?.loja_url ?? null;

  const fetchStatus = useCallback(
    async (isRefresh = false) => {
      if (!apiKey || !isSupported) return;
      if (!isRefresh) setLoading(true);
      setError(false);
      try {
        const res = await averonApi.getApplePaymentStatus(apiKey, alunoToken);
        setStatus(res);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, alunoToken, isSupported]
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { enabled, produtos, loading, error, refresh: fetchStatus, siteCheckoutUrl };
}
