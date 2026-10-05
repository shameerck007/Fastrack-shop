"use client";

import { CustomerStateCtx, useFetchCustomerState } from "@/lib/hooks/useCustomerHeaderState";

export default function CustomerStateProvider({ children }: { children: React.ReactNode }) {
  const state = useFetchCustomerState();
  return <CustomerStateCtx.Provider value={state}>{children}</CustomerStateCtx.Provider>;
}
