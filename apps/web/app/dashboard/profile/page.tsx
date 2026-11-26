/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import { PageTitle, SettingsRow } from '@/components/settings-row';
import { getSession } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import { DeleteAccountForm, ProfileForm } from '../forms';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const [profile, session] = await Promise.all([getProfile(), getSession()]);
  return (
    <div>
      <PageTitle title="Profile" line="How you appear in your groups, and your account." />
      <SettingsRow
        id="display-name"
        title="Display name"
        description="The only thing members of your groups see about you, next to your role."
      >
        <ProfileForm displayName={profile.displayName} />
      </SettingsRow>
      <SettingsRow
        id="sign-in"
        title="Sign-in"
        description="You sign in with this email address. Alerts you agree to receive are sent to it."
      >
        <p className="bg-card rounded-xl border px-4 py-3 text-sm break-all">
          {session?.email ?? '—'}
        </p>
      </SettingsRow>
      <SettingsRow
        id="delete-account"
        title="Delete account"
        tone="danger"
        description={
          <>
            <p>
              This removes your account, your profile, your group memberships and your
              accountability choices. You leave every group; members who agreed to receive your
              alerts are told you left, as with any departure.
            </p>
            <p>Groups where you are the only member are dissolved. This cannot be undone.</p>
          </>
        }
      >
        <DeleteAccountForm />
      </SettingsRow>
    </div>
  );
}
