/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Contact, ProsePage, Section } from '@/components/prose-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Resolve stores, what never leaves your device, and your choices.',
};

/** Based on docs/qa/DATA_INVENTORY.md; keep the two in step. */
export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy policy"
      updated="25 November 2026"
      intro={
        <p>
          What Resolve stores, what stays on your device, and what accountability alerts contain.
        </p>
      }
    >
      <Section title="What stays on your device">
        <ul>
          <li>
            <strong>Images and video frames.</strong> The media filter classifies them with a model
            that runs inside your browser. They are never uploaded to Resolve or anyone else. To
            check an image the page itself cannot let the extension read, the extension may fetch
            that same image again from the site that served it, without your cookies.
          </li>
          <li>
            <strong>Focus Mode.</strong> Whether it is on and which optional sites it blocks are
            kept in your browser only. Focus Mode never records or sends the sites you try to visit,
            and it never alerts anyone.
          </li>
          <li>
            <strong>The pages you visit.</strong> The extension blocks your group&apos;s websites
            inside your browser. If you turn on accountability alerts, it looks at page addresses
            briefly, on your device only, to recognise a blocked visit. Addresses are never stored
            or sent.
          </li>
          <li>
            <strong>Your sign-in and settings</strong> are kept in the extension&apos;s private
            storage, which websites cannot read.
          </li>
        </ul>
      </Section>

      <Section title="What Resolve stores">
        <ul>
          <li>Your account: email address and password (handled by Amazon Cognito).</li>
          <li>Your display name, if you set one. Members of your groups see it.</li>
          <li>Your groups, roles and when you joined.</li>
          <li>
            Each group&apos;s blocked websites, who added them and a change history (one year). Only
            the group&apos;s admins can see them.
          </li>
          <li>
            Your accountability choices: who may receive your alerts and whose alerts you agreed to
            receive, with a change history (one year). Nobody else can see or change them, including
            admins.
          </li>
          <li>
            For alerts: a short-lived record that an alert is due (30 days) and whether it was
            delivered. These never contain a website, address or page title.
          </li>
          <li>
            Technical logs (kept up to 90 days) with the kind of request and its result. They do not
            contain what you browse, your name, email address or sign-in tokens.
          </li>
        </ul>
      </Section>

      <Section title="Accountability alerts">
        <p>
          Alerts are off unless you choose to share them, and they reach only members you chose who
          also agreed to receive them. There are only two kinds: a generic notice that you opened a
          website your group marked as non-negotiable (never which one), and a notice that you left
          or were removed from a group. Alerts are emails; once sent, they are kept by the
          recipient&apos;s email provider.
        </p>
      </Section>

      <Section title="Who we share data with">
        <p>
          Resolve runs on Amazon Web Services (Asia Pacific, Singapore), which stores the data above
          and sends alert emails on our behalf. We do not sell data, show advertising, or share data
          with anyone else, except when the law requires it.
        </p>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Turn the media filter and accountability alerts on or off at any time.</li>
          <li>Change or withdraw your sharing and consent at any time, per group.</li>
          <li>Leave a group; your choices in it are deleted.</li>
          <li>
            Delete your account from your <Link href="/dashboard/profile">profile</Link>. This
            removes your account, profile, memberships and accountability choices. A few records in
            your former groups keep your account ID (never your email) until they expire: who added
            a blocked website and change histories (up to one year), and alert records (up to 30
            days).
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p>Resolve is not intended for children under 13.</p>
      </Section>

      <Section title="Changes">
        <p>
          We will update this page when what Resolve stores changes, and say so in the release
          notes.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Email <Contact />.
        </p>
      </Section>
    </ProsePage>
  );
}
