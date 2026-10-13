"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import RegisterForm from "@/components/RegisterForm";
import { useDefaultCountry } from "@/components/DefaultCountryProvider";

const LoginModalCtx = createContext<{ openLogin: () => void }>({ openLogin: () => {} });

/** Opens the same sign-in form as the /login page, in a pop-up over whatever page the shopper is on.
 * The /login page itself stays (redirects from protected pages and direct links still use it). */
export function useLoginModal() {
  return useContext(LoginModalCtx);
}

export default function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"login" | "register">("login");
  const [prefill, setPrefill] = useState<{ email?: string; phone?: string }>({});
  const pathname = usePathname();
  const country = useDefaultCountry();
  const close = useCallback(() => setOpen(false), []);
  const openLogin = useCallback(() => {
    setView("login");
    setPrefill({});
    setOpen(true);
  }, []);

  // Leaving the page (for example to Create account) closes the pop-up.
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <LoginModalCtx.Provider value={{ openLogin }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={view === "login" ? "Sign in" : "Create account"}>
          <div className="absolute inset-0 bg-neutral-900/55 backdrop-blur-sm" onClick={close} />
          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-[420px] sm:rounded-3xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-brand-700 via-sky-500 to-brand-700" />
            <button
              onClick={close}
              aria-label="Close"
              className="absolute end-3 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-600 transition hover:bg-neutral-200"
            >
              ✕
            </button>
            <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
              {view === "login" ? (
                <LoginForm
                  defaultCountryCode={country}
                  modal
                  onDone={close}
                  onRegister={(p) => {
                    setPrefill(p);
                    setView("register");
                  }}
                />
              ) : (
                <RegisterForm defaultCountryCode={country} modal prefill={prefill} onDone={close} onLogin={() => setView("login")} />
              )}
            </div>
          </div>
        </div>
      )}
    </LoginModalCtx.Provider>
  );
}
