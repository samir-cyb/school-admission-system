import { apiBaseUrl } from "./config";
import { recordServerDate } from "./clock";

// ---------- Contract types (the API table in README.md) ----------

export type HoldStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";

export interface ClassSummary {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  createdAt?: string;
}

export interface ClassCreated {
  id: string;
  name: string;
  totalSeats: number;
}

export interface HoldCreated {
  holdId: string;
  classId: string;
  studentId: string;
  status: HoldStatus;
  expiresAt: string;
}

export interface Hold {
  holdId: string;
  classId: string;
  className?: string;
  status: HoldStatus;
  expiresAt: string;
  createdAt?: string;
  confirmedAt?: string;
}

export interface MyHold extends Hold {
  className: string;
}

// ---------- Errors ----------

/** The server answered with a 4xx/5xx and (usually) `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly holdId?: string;

  constructor(status: number, code: string, message: string, holdId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.holdId = holdId;
  }
}

/** The request never got an HTTP answer: server down, wrong URL, no network, CORS. */
export class NetworkError extends Error {
  constructor() {
    super("Network request failed");
    this.name = "NetworkError";
  }
}

// ---------- Transport ----------

const TIMEOUT_MS = 15_000;

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  studentId?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, { method = "GET", body, studentId, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (studentId) headers["X-Student-Id"] = studentId;

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : (signal ?? timeout);

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (err) {
    if (signal?.aborted) throw err; // React Query cancelled it; not a network problem
    throw new NetworkError();
  }
  recordServerDate(res.headers.get("Date"), startedAt, Date.now());

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; holdId?: string } } | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? res.statusText, err?.holdId);
  }

  return json as T;
}

// ---------- Endpoints ----------

export const api = {
  createClass: (input: { name: string; totalSeats: number }) =>
    request<ClassCreated>("/classes", { method: "POST", body: input }),

  listClasses: (signal?: AbortSignal) => request<ClassSummary[]>("/classes", { signal }),

  getClass: (classId: string, signal?: AbortSignal) =>
    request<ClassSummary>(`/classes/${encodeURIComponent(classId)}`, { signal }),

  createHold: (classId: string, studentId: string) =>
    request<HoldCreated>(`/classes/${encodeURIComponent(classId)}/holds`, { method: "POST", studentId }),

  getHold: (holdId: string, signal?: AbortSignal) =>
    request<Hold>(`/holds/${encodeURIComponent(holdId)}`, { signal }),

  confirmHold: (holdId: string, studentId: string) =>
    request<{ holdId: string; status: HoldStatus }>(`/holds/${encodeURIComponent(holdId)}/confirm`, {
      method: "POST",
      studentId,
    }),

  cancelHold: (holdId: string, studentId: string) =>
    request<void>(`/holds/${encodeURIComponent(holdId)}`, { method: "DELETE", studentId }),

  myHolds: (studentId: string, signal?: AbortSignal) => request<MyHold[]>("/me/holds", { studentId, signal }),
};
