/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

// Shared by the server page and the client tabs (a 'use client' module would hand the server a
// client reference instead of this array).
export const GROUP_TABS = ['websites', 'accountability', 'members', 'settings'] as const;
export type GroupTab = (typeof GROUP_TABS)[number];
