/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Contact, ProsePage, Section } from '@/components/prose-page';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Help with Resolve, feedback and reporting a problem.',
};

export default function SupportPage() {
  return (
    <ProsePage
      title="Support"
      intro={
        <p>
          New to Resolve? Start with <Link href="/getting-started">getting started</Link>. For
          anything else, email <Contact />.
        </p>
      }
    >
      <Section title="Common questions">
        <ul>
          <li>
            <strong>The extension says it cannot reach the background service.</strong> Reload the
            extension from your browser&apos;s extensions page, then reopen the popup.
          </li>
          <li>
            <strong>A website is blocked that should not be.</strong> Ask a group admin to remove or
            reclassify it. Essential services such as Gmail, YouTube and Microsoft 365 always stay
            reachable.
          </li>
          <li>
            <strong>New blocks are not applying yet.</strong> The extension checks for changes every
            15 minutes. Reselecting your group in the popup checks right away.
          </li>
          <li>
            <strong>Too many or too few images are blurred.</strong> Change the sensitivity in the
            extension&apos;s settings. The model makes mistakes; it is a support, not a guarantee.
          </li>
          <li>
            <strong>I did not receive an alert.</strong> Alerts reach only members who agreed to
            receive them, at most once every ten minutes per member, and not every blocked visit
            produces one (for example, ones a page or ad caused). Check your spam folder too.
          </li>
          <li>
            <strong>Deleting your account.</strong> Use &ldquo;Delete account&rdquo; on your{' '}
            <Link href="/dashboard/profile">profile</Link>.
          </li>
        </ul>
      </Section>

      <Section title="Beta feedback">
        <p>
          Feedback is welcome by email at <Contact />. Please never include websites you visited,
          screenshots of pages, or other people&apos;s information. Describe what you did and what
          you expected instead.
        </p>
      </Section>

      <Section title="Reporting a security or privacy problem">
        <p>
          Email <Contact /> with &ldquo;Security&rdquo; in the subject. Please give us a chance to
          fix the problem before sharing it publicly.
        </p>
      </Section>
    </ProsePage>
  );
}
