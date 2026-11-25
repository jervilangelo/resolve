/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { Toast } from 'radix-ui';
import { type ReactNode, createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error';
interface Item {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

/** Shows a short confirmation or problem message in the corner; screen readers announce it. */
export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const show = useCallback((message: string, tone: Tone = 'success') => {
    nextId += 1;
    const id = nextId;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  return (
    <ToastContext value={show}>
      <Toast.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((item) => (
          <Toast.Root
            key={item.id}
            type={item.tone === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => {
              if (!open) setItems((current) => current.filter((i) => i.id !== item.id));
            }}
            className={cn(
              'rs-toast flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg',
              item.tone === 'error'
                ? 'bg-card text-destructive border-destructive/40'
                : 'bg-primary text-primary-foreground border-transparent',
            )}
          >
            <Toast.Description className="flex-1">{item.message}</Toast.Description>
            <Toast.Close
              aria-label="Dismiss"
              className="-mr-1 rounded-full px-2 text-base leading-none opacity-70 hover:opacity-100"
            >
              ×
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none sm:right-4 sm:bottom-4 sm:p-0" />
      </Toast.Provider>
    </ToastContext>
  );
}
