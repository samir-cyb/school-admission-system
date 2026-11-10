import { useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ApiError, NetworkError } from "./lib/api";
import { setOffline } from "./lib/connection";
import { StudentProvider } from "./lib/student";
import { I18nProvider } from "./i18n/I18nProvider";
import { ToastProvider } from "./components/Toasts";
import { AppShell } from "./components/AppShell";
import { ClassListPage } from "./routes/ClassListPage";
import { CreateClassPage } from "./routes/CreateClassPage";
import { HoldPage } from "./routes/HoldPage";
import { MyHoldsPage } from "./routes/MyHoldsPage";
import { NotFoundPage } from "./routes/NotFoundPage";

export function createQueryClient(): QueryClient {
  const track = (err: unknown) => setOffline(err instanceof NetworkError);
  return new QueryClient({
    queryCache: new QueryCache({ onError: track, onSuccess: () => setOffline(false) }),
    mutationCache: new MutationCache({ onError: track, onSuccess: () => setOffline(false) }),
    defaultOptions: {
      queries: {
        staleTime: 1000,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        // Retry network blips, never retry a real 4xx answer.
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <StudentProvider>
          <MotionConfig reducedMotion="user">
            <ToastProvider>{children}</ToastProvider>
          </MotionConfig>
        </StudentProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/classes" replace />} />
        <Route path="/classes" element={<ClassListPage />} />
        <Route path="/admin/classes/new" element={<CreateClassPage />} />
        <Route path="/holds/:holdId" element={<HoldPage />} />
        <Route path="/me" element={<MyHoldsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  );
}
