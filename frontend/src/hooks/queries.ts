import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export const POLL_CLASSES_MS = 3000;
export const POLL_HOLD_MS = 3000;
export const POLL_MINE_MS = 5000;

export const qk = {
  classes: ["classes"] as const,
  class: (id: string) => ["classes", id] as const,
  hold: (id: string) => ["holds", id] as const,
  mine: (studentId: string | null) => ["me", "holds", studentId] as const,
};

/** PDF §1.5 UI: seat counts refresh every few seconds without a page reload. */
export function useClasses() {
  return useQuery({
    queryKey: qk.classes,
    queryFn: ({ signal }) => api.listClasses(signal),
    refetchInterval: POLL_CLASSES_MS,
  });
}

export function useClass(classId: string | undefined) {
  return useQuery({
    queryKey: qk.class(classId ?? ""),
    queryFn: ({ signal }) => api.getClass(classId!, signal),
    enabled: !!classId,
    refetchInterval: POLL_CLASSES_MS,
  });
}

export function useHold(holdId: string | undefined) {
  return useQuery({
    queryKey: qk.hold(holdId ?? ""),
    queryFn: ({ signal }) => api.getHold(holdId!, signal),
    enabled: !!holdId,
    // Only an active hold can still change on its own.
    refetchInterval: (q) => (q.state.data?.status === "HELD" ? POLL_HOLD_MS : false),
  });
}

export function useMyHolds(studentId: string | null) {
  return useQuery({
    queryKey: qk.mine(studentId),
    queryFn: ({ signal }) => api.myHolds(studentId!, signal),
    enabled: !!studentId,
    refetchInterval: POLL_MINE_MS,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ["classes"] }),
    qc.invalidateQueries({ queryKey: ["me"] }),
    qc.invalidateQueries({ queryKey: ["holds"] }),
  ]);
}

export function useCreateClass() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.createClass, onSuccess: () => invalidate() });
}

export function useApply() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ classId, studentId }: { classId: string; studentId: string }) => api.createHold(classId, studentId),
    onSettled: () => invalidate(),
  });
}

export function useConfirm() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ holdId, studentId }: { holdId: string; studentId: string }) => api.confirmHold(holdId, studentId),
    onSettled: () => invalidate(),
  });
}

export function useCancel() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ holdId, studentId }: { holdId: string; studentId: string }) => api.cancelHold(holdId, studentId),
    onSettled: () => invalidate(),
  });
}
