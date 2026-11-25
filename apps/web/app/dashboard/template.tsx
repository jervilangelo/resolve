/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ReactNode } from 'react';

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="rs-page">{children}</div>;
}
