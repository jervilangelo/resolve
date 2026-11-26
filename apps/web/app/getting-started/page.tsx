/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage, Section } from '@/components/prose-page';

export const metadata: Metadata = {
  title: 'Getting started',
  description: 'Set up Resolve: account, group, extension, protection and accountability.',
};

export default function GettingStartedPage() {
  return (
    <ProsePage
      title="Getting started"
      intro={<p>Six steps, about ten minutes. Everything can be changed later.</p>}
    >
      <Section title="1. Create your account">
        <p>
          <Link href="/dashboard">Sign in</Link> and choose &ldquo;Create an account&rdquo;. Then
          add a display name on your <Link href="/dashboard/profile">profile</Link> so your group
          recognises you.
        </p>
      </Section>

      <Section title="2. Create or join a group">
        <p>
          Create a group under <Link href="/dashboard/groups">Groups</Link>, or open an invitation
          link from a group admin. You can belong to several groups.
        </p>
      </Section>

      <Section title="3. Install the extension">
        <p>
          Install Resolve for Chrome, Edge or Brave and sign in from its popup. Firefox is not
          supported yet.
        </p>
      </Section>

      <Section title="4. Choose your active group">
        <p>
          In the popup, choose the group this browser protects for. Its blocked websites apply
          straight away, and the popup shows when they are on.
        </p>
      </Section>

      <Section title="5. Turn on media blurring (optional)">
        <p>
          In the extension&apos;s settings, turn on &ldquo;Blur sensitive images and videos&rdquo;
          and choose a sensitivity. Images are checked on your device and never uploaded.
        </p>
      </Section>

      <Section title="6. Set up accountability (optional)">
        <p>
          On your group&apos;s page, under Accountability, choose who may receive your alerts and
          agree to receive others&apos; if you wish. Then turn on &ldquo;Alert my accountability
          partners about blocked visits&rdquo; in the extension&apos;s settings. Alerts never say
          which website it was.
        </p>
      </Section>

      <Section title="Good to know">
        <ul>
          <li>Resolve is a supporting tool and can be bypassed; it is not a guarantee.</li>
          <li>Each person controls their own sharing; admins cannot change it.</li>
          <li>
            Questions? See the <Link href="/faq">FAQ</Link>.
          </li>
        </ul>
      </Section>
    </ProsePage>
  );
}
