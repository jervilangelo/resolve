/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { LINK_LIKE, type OutboxItem, formatAlertTime } from '@resolve/contracts';

/**
 * The generic alert emails (docs/MASTER_PLAN.md §7). They never mention a website, URL, page title
 * or anything else about browsing, and they say plainly that an extension report is not proof of
 * intent. Installation alerts (§7.4) carry only the sender's name, the event and its time.
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

const FOOTER = 'Resolve — Take every thought captive.';

function render(subject: string, paragraphs: string[]): EmailMessage {
  return {
    subject,
    text: [...paragraphs, FOOTER].join('\n\n'),
    html:
      '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">' +
      paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
      `<p style="color:#64748b;font-size:12px">${escapeHtml(FOOTER)}</p></body></html>`,
  };
}

export function alertEmail(item: OutboxItem, dashboardUrl: string): EmailMessage {
  // Names set before links were disallowed are never shown in an email.
  const senderName = item.senderName && !LINK_LIKE.test(item.senderName) ? item.senderName : null;
  const groupName = LINK_LIKE.test(item.groupName) ? 'your accountability group' : item.groupName;
  const who = senderName ?? 'A member of your accountability group';
  const theirs = senderName ? `${senderName}’s` : 'their';

  if (item.kind === 'EXTENSION_REMOVED' || item.kind === 'EXTENSION_INACTIVE') {
    // No group name and no group link: only the name, what happened and when.
    const name = senderName ?? 'a member of your accountability group';
    const when = item.occurredAt ? formatAlertTime(item.occurredAt) : null;
    const manage = `You receive this because you agreed to receive ${theirs} alerts of this kind. You can stop at any time under Accountability in your group: ${new URL('/dashboard/groups', dashboardUrl).toString()}`;
    return item.kind === 'EXTENSION_REMOVED'
      ? render('Resolve was removed from a browser', [
          `Resolve was removed from one of ${name}’s browsers${when ? ` on ${when}` : ''}.`,
          'This can also happen when someone reinstalls Resolve or changes browsers, so please ' +
            'reach out with grace and care rather than assume the worst.',
          manage,
        ])
      : render('Resolve hasn’t checked in from a browser', [
          `Resolve hasn’t checked in from one of ${name}’s browsers since ${when ?? 'some time ago'}.`,
          'Most often this simply means that browser has been closed, or the computer is off or ' +
            'offline. It can also mean Resolve was turned off. Please reach out with grace and care.',
          manage,
        ]);
  }

  const settings = new URL(`/dashboard/groups/${item.groupId}`, dashboardUrl).toString();
  return item.kind === 'NON_NEGOTIABLE_NAVIGATION'
    ? render('Accountability alert from Resolve', [
        `${who} triggered a non-negotiable website restriction in ${groupName}.`,
        'Resolve never shares which website it was. This alert comes from the Resolve browser ' +
          'extension and is not proof of intent, so please reach out with grace and care.',
        `You receive this because you agreed to receive ${theirs} alerts. You can stop at any ` +
          `time under Accountability in the group: ${settings}`,
      ])
    : render('Group update from Resolve', [
        `${who} is no longer a member of ${groupName}.`,
        `You receive this because you agreed to receive ${theirs} alerts in this group. You can ` +
          `review your accountability settings in the group: ${settings}`,
      ]);
}
