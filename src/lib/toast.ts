import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  ok: boolean;
  message: string;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function pushToast(message: string, ok = true) {
  const id = ++seq;
  toasts = [...toasts, { id, ok, message }];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4200);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts
  );
}
