/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import '@/styles/globals.css';
import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/** Mount an extension page (popup, options) into its `#root` element. */
export function mount(node: ReactNode) {
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(<StrictMode>{node}</StrictMode>);
}
