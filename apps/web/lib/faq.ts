/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: { id: string; title: string; items: FaqItem[] }[] = [
  {
    id: 'about',
    title: 'About Resolve',
    items: [
      {
        q: 'What does Resolve do?',
        a: 'Resolve is a browser extension with an online dashboard. It blocks websites your accountability group chooses, can blur explicit images and videos on your device, and, only if you turn it on, alerts partners you choose who agree to receive alerts.',
      },
      {
        q: 'What does it cost?',
        a: 'Nothing. Resolve is free and has no ads or paid tiers. Voluntary donations help keep it running but never unlock anything.',
      },
      {
        q: 'Does it replace accountability in a church?',
        a: 'No. Resolve is a supporting tool, never a replacement for membership, discipleship and pastoral care in a local church.',
      },
    ],
  },
  {
    id: 'browsers',
    title: 'Browsers and installation',
    items: [
      {
        q: 'Which browsers are supported?',
        a: 'Google Chrome, Microsoft Edge and Brave on a computer. Firefox is planned but not available yet, and phones are not supported.',
      },
      {
        q: 'How do I install it?',
        a: 'Download the latest release from the Download page, unzip it, open your browser’s extensions page, turn on Developer mode and choose “Load unpacked”. Then sign in from the extension’s popup.',
      },
      {
        q: 'The extension says it cannot reach the background service.',
        a: 'Reload Resolve on your browser’s extensions page, then reopen the popup.',
      },
    ],
  },
  {
    id: 'websites',
    title: 'Website restrictions',
    items: [
      {
        q: 'Who decides which websites are blocked?',
        a: 'Group admins manage the list and choose whether each website is non-negotiable or additional. Members can add additional websites but cannot see the list.',
      },
      {
        q: 'What is the difference between non-negotiable and additional?',
        a: 'Both are blocked. Only a deliberate visit to a non-negotiable website can lead to an accountability alert, and only for members who turned alerts on.',
      },
      {
        q: 'A website is blocked that should not be.',
        a: 'Ask a group admin to remove or reclassify it. Essential services such as Gmail and Microsoft 365 can never be blocked.',
      },
      {
        q: 'New blocks are not applying yet.',
        a: 'The extension checks for changes every 15 minutes. Choosing your group again in the popup checks right away.',
      },
    ],
  },
  {
    id: 'groups',
    title: 'Groups and accountability',
    items: [
      {
        q: 'How do I join a group?',
        a: 'Open the invite link a group admin sends you, or paste it on the Groups page of your dashboard.',
      },
      {
        q: 'Are accountability alerts on by default?',
        a: 'No. Alerts are off until you turn them on and choose who may receive them. Each person you choose must also agree before they receive anything.',
      },
      {
        q: 'What sends an alert?',
        a: 'Only two things: a deliberate visit to a website on your group’s non-negotiable list, and leaving or being removed from a group. Blurring, ordinary browsing and additional websites never do.',
      },
      {
        q: 'What does an alert say?',
        a: 'That a restriction was triggered or that someone left, in which group. It never names the website, and a blocked visit is not proof of intent.',
      },
      {
        q: 'I did not receive an alert.',
        a: 'Alerts reach only people who agreed to receive them, at most once every ten minutes per member, and not every block produces one (for example, ones a page or ad caused). Check your spam folder too.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and on-device AI',
    items: [
      {
        q: 'Can my group see my browsing?',
        a: 'No. Alerts never include your browsing history or the addresses you visit, and admins cannot see your accountability choices.',
      },
      {
        q: 'Are my images uploaded to be checked?',
        a: 'No. The model that decides what to blur is packaged inside the extension and runs on your device.',
      },
      {
        q: 'Where is my account information kept?',
        a: 'Accounts and groups run on AWS-managed services with security controls. See the privacy policy for exactly what is stored.',
      },
      {
        q: 'Too many or too few images are blurred.',
        a: 'Change the sensitivity in the extension’s settings. The model makes mistakes in both directions.',
      },
    ],
  },
  {
    id: 'limits',
    title: 'Limitations',
    items: [
      {
        q: 'Can Resolve be turned off?',
        a: 'Yes. Any extension can be disabled or removed, and Resolve protects only the browser it is installed in. It supports honest people; it is not a lock.',
      },
      {
        q: 'Does it work on every page and video?',
        a: 'No. Some images and protected videos cannot be checked (they stay blurred by default), and pages a site saved for offline use may still open.',
      },
      {
        q: 'How do I report a security or privacy problem?',
        a: 'Email resolved.site@gmail.com with “Security” in the subject, and please allow time for a fix before sharing it publicly.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Use “Delete account” on your dashboard profile. It removes your account and your group memberships.',
      },
    ],
  },
];
