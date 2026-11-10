import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../i18n/I18nProvider";
import { StudentProvider } from "../lib/student";
import { ToastProvider } from "../components/Toasts";

export function renderAt(path: string, routePattern: string, element: ReactElement, opts: { studentId?: string | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <I18nProvider lang="bn">
          <StudentProvider initialId={opts.studentId ?? null}>
            <ToastProvider>
              <Routes>
                <Route path={routePattern} element={element} />
                <Route path="*" element={<p>other page</p>} />
              </Routes>
            </ToastProvider>
          </StudentProvider>
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Minimal fetch double: maps "METHOD path" to a JSON response. */
export function mockFetch(routes: Record<string, { status?: number; body?: unknown } | (() => { status?: number; body?: unknown })>) {
  const calls: { method: string; path: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, headers: (init?.headers ?? {}) as Record<string, string> });
    const entry = routes[`${method} ${url.pathname}`];
    if (!entry) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "nf" } }), { status: 404 });
    const { status = 200, body } = typeof entry === "function" ? entry() : entry;
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}
