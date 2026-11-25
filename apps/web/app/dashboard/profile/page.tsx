/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { profileSchema } from '@resolve/contracts';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { DeleteAccountForm, ProfileForm } from '../forms';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const profile = await api('/v1/me', profileSchema);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Profile</h1>
      <ProfileForm displayName={profile.displayName} />
      <section aria-labelledby="delete-account" className="space-y-3 border-t pt-8">
        <h2 id="delete-account" className="text-destructive font-semibold">
          Delete account
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          This removes your account, your profile, your group memberships and your accountability
          choices. You leave every group; members who agreed to receive your alerts are told you
          left, as with any departure. Groups where you are the only member are dissolved. This
          cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
