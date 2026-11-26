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
  title: 'Terms of use',
  description: 'The terms for using Resolve.',
};

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms of use"
      updated="25 November 2026"
      intro={
        <p>
          These terms apply to the Resolve website, dashboard and browser extension. By using them
          you agree to these terms and to the <Link href="/privacy">privacy policy</Link>.
        </p>
      }
    >
      <Section title="A supporting tool">
        <p>
          Resolve is offered to help people who choose to pursue faithfulness online. It is a
          supporting tool, never a replacement for the local church, and it can be bypassed: the
          extension can be turned off or removed, other browsers and devices are not covered, and
          the media filter makes mistakes in both directions. Features may change over time.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          Keep your sign-in details to yourself and tell us if you think someone else has used your
          account. You can delete your account at any time from your profile.
        </p>
      </Section>

      <Section title="Groups and accountability">
        <ul>
          <li>Joining a group is voluntary, and you can leave at any time.</li>
          <li>
            Group admins decide which websites the group blocks. Members can add websites; only
            admins can see or remove the list.
          </li>
          <li>
            Accountability is your choice: you decide who may receive your alerts, and recipients
            decide whether to receive them. Admins cannot change either.
          </li>
          <li>
            An alert is reported by software on a device someone controls. It is not proof of
            intent. Please respond to alerts with grace and care.
          </li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>Do not use Resolve to:</p>
        <ul>
          <li>monitor anyone without their knowledge or pressure anyone into sharing alerts;</li>
          <li>harass, shame or threaten anyone, including over an alert;</li>
          <li>put links, web addresses or misleading text in names to deceive alert recipients;</li>
          <li>attack, overload or try to get around the service&apos;s security or limits.</li>
        </ul>
        <p>We may suspend accounts or groups that break these rules.</p>
      </Section>

      <Section title="No warranty">
        <p>
          Resolve is provided as is, without guarantees that it will always be available, block
          everything you intend, or deliver every alert. To the extent the law allows, the operator
          is not liable for indirect or consequential losses from using it.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update these terms; the date above shows the latest version. Questions: <Contact />
          .
        </p>
      </Section>
    </ProsePage>
  );
}
