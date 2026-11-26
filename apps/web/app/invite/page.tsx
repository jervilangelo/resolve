/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import { Invitation } from './invitation';

export const metadata: Metadata = { title: 'Group invitation', robots: { index: false } };

/** Invite links look like /invite#<token>; the client reads the fragment (see invitation.tsx). */
export default function InvitationPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 sm:px-6">
      <Invitation />
    </section>
  );
}
