/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { defineContentScript } from 'wxt/utils/define-content-script';

// Registered at runtime rather than in the manifest, so the extension requests no host access
// until the on-device media filter (roadmap phase 6) registers it with the permissions it needs.
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    // Feature modules attach here when they ship.
  },
});
