/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { LINK_LIKE, type OutboxItem } from '@resolve/contracts';

/**
 * The two generic alert emails (docs/MASTER_PLAN.md §7). They name the sender and the group, never
 * a website, URL, page title or anything else about browsing, and they say plainly that an
 * extension report is not proof of intent.
 */
export interface EmailMessage {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function alertEmail(item: OutboxItem, dashboardUrl: string): EmailMessage {
  // Names set before links were disallowed are never shown in an email.
  const senderName = item.senderName && !LINK_LIKE.test(item.senderName) ? item.senderName : null;
  const groupName = LINK_LIKE.test(item.groupName) ? 'your accountability group' : item.groupName;
  const who = senderName ?? 'A member of your accountability group';
  const theirs = senderName ? `${senderName}’s` : 'their';
  const settings = new URL(`/dashboard/groups/${item.groupId}`, dashboardUrl).toString();

  const paragraphs =
    item.kind === 'NON_NEGOTIABLE_NAVIGATION'
      ? [
          `${who} triggered a non-negotiable website restriction in ${groupName}.`,
          'Resolve never shares which website it was. This alert comes from the Resolve browser ' +
            'extension and is not proof of intent, so please reach out with grace and care.',
          `You receive this because you agreed to receive ${theirs} alerts. You can stop at any ` +
            `time under Accountability in the group: ${settings}`,
        ]
      : [
          `${who} is no longer a member of ${groupName}.`,
          `You receive this because you agreed to receive ${theirs} alerts in this group. You can ` +
            `review your accountability settings in the group: ${settings}`,
        ];

  const subject =
    item.kind === 'NON_NEGOTIABLE_NAVIGATION'
      ? 'Accountability alert from Resolve'
      : 'Group update from Resolve';
  const footer = 'Resolve — Take every thought captive.';

  return {
    subject,
    text: [...paragraphs, footer].join('\n\n'),
    html:
      '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">' +
      paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
      `<p style="color:#64748b;font-size:12px">${escapeHtml(footer)}</p></body></html>`,
  };
}
