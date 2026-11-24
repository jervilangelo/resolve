/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { profileSchema } from '@resolve/contracts';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProfileForm } from '../forms';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const profile = await api('/v1/me', profileSchema);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Profile</h1>
      <ProfileForm displayName={profile.displayName} />
    </div>
  );
}
