/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Reveal } from '@/components/landing/reveal';
import { Button } from '@/components/ui/button';
import { CONTACT_EMAIL } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  path: '/tutorial',
  title: 'Tutorial: install and use Resolve',
  description:
    'Step-by-step guide with screenshots: install Resolve, sign in, blur explicit images, use Focus Mode, set up accountability and fix common problems.',
});

const SECTIONS = [
  { id: 'get', title: 'Get Resolve' },
  { id: 'install', title: 'Install the extension' },
  { id: 'sign-in', title: 'Sign in and check it is ready' },
  { id: 'blurring', title: 'Blur sensitive images' },
  { id: 'focus', title: 'Use Focus Mode' },
  { id: 'groups', title: 'Groups and website restrictions' },
  { id: 'accountability', title: 'Accountability alerts' },
  { id: 'blocked', title: 'The two blocked screens' },
  { id: 'help', title: 'Fix common problems' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)?.title ?? '';
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 py-14 sm:py-20">
      <h2 id={`${id}-title`} className="font-display text-3xl leading-tight sm:text-4xl">
        {title}
      </h2>
      <div className="mt-6 space-y-6 text-base leading-relaxed sm:text-lg [&_li]:max-w-[68ch] [&_p]:max-w-[68ch]">
        {children}
      </div>
    </section>
  );
}

/** Numbered steps; the order is carried by a real ordered list. */
function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="marker:text-muted-foreground list-decimal space-y-3 pl-6 marker:font-semibold">
      {children}
    </ol>
  );
}

function Shot({
  src,
  width,
  height,
  alt,
  caption,
  narrow = false,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: ReactNode;
  narrow?: boolean;
}) {
  return (
    <figure data-reveal className={narrow ? 'max-w-[20rem]' : undefined}>
      <div className="bg-muted overflow-hidden rounded-2xl p-2 sm:p-3">
        <Image
          src={`/tutorial/${src}`}
          alt={alt}
          width={width}
          height={height}
          sizes={narrow ? '320px' : '(min-width: 1024px) 720px, 100vw'}
          className="h-auto w-full rounded-xl"
        />
      </div>
      <figcaption className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {caption}
      </figcaption>
    </figure>
  );
}

/** What the person should see once a step worked. */
function Expect({ children }: { children: ReactNode }) {
  return (
    <p className="bg-muted/60 rounded-2xl px-5 py-4 text-base">
      <span className="font-semibold">You should see: </span>
      {children}
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-base">{children}</p>;
}

const b = (text: string) => <strong className="font-semibold">{text}</strong>;

export default function TutorialPage() {
  return (
    <>
      <Reveal />
      <div className="bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <h1 className="font-display text-4xl leading-tight sm:text-6xl lg:text-7xl">
            How to use Resolve
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">
            A complete guide for first-time users, from downloading the extension to setting up
            accountability with people you trust. No experience with browser extensions needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/downloads">Download Resolve</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#install">Start with installing</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[15rem_1fr] lg:gap-16">
        <nav aria-label="Tutorial sections" className="pt-10 lg:pt-20">
          <div className="lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold">On this page</h2>
            <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted block rounded-lg px-2 py-1.5 transition-colors"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-3xl pb-20">
          <Section id="get">
            <p>
              Resolve has two parts: a free {b('browser extension')} that does the protecting, and
              an online {b('dashboard')} on this website where you manage your account and groups.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Works on a computer in {b('Google Chrome')}, {b('Microsoft Edge')} and {b('Brave')}.
              </li>
              <li>
                Firefox is planned but not available yet. Phones and tablets are not supported.
              </li>
              <li>
                Resolve is not in a browser store. It is distributed directly from the{' '}
                <Link href="/downloads" className="underline underline-offset-4">
                  Download page
                </Link>{' '}
                and from Resolve’s GitHub Releases.
              </li>
            </ul>
            <Shot
              src="download-page.png"
              width={1100}
              height={742}
              alt="The Resolve Download page showing the latest version, with a Download button for Google Chrome, Microsoft Edge and Brave, and Firefox marked as not available yet."
              caption="The Download page. Every supported browser uses the same file."
            />
          </Section>

          <Section id="install">
            <Steps>
              <li>
                On the{' '}
                <Link href="/downloads" className="underline underline-offset-4">
                  Download page
                </Link>
                , choose {b('Download')} under your browser. A file named like{' '}
                <span className="font-medium">resolve-(version)-chrome.zip</span> is saved to your
                Downloads folder.
              </li>
              <li>
                Unzip it: right-click the file and choose {b('Extract All')} (Windows) or
                double-click it (Mac). Move the new folder somewhere you will keep, such as
                Documents. The browser loads Resolve from this folder, so do not delete it later.
              </li>
              <li>
                Open your browser’s extensions page by typing its address into the address bar:{' '}
                {b('chrome://extensions')}, {b('edge://extensions')} or {b('brave://extensions')}.
              </li>
              <li>
                Turn on {b('Developer mode')} (top right in Chrome and Brave, left side in Edge).
              </li>
              <li>
                Choose {b('Load unpacked')}, then select the unzipped folder (the one that contains
                a file named manifest.json) and confirm.
              </li>
            </Steps>
            <Shot
              src="extensions-page.png"
              width={1100}
              height={640}
              alt="The Chrome extensions page with Developer mode switched on, the Load unpacked button at the top left, and the Resolve card switched on."
              caption="After Load unpacked, Resolve appears on the extensions page, switched on."
            />
            <Expect>
              a card named {b('Resolve')} with its version number and its switch turned on.
            </Expect>
            <h3 className="pt-2 text-xl font-semibold">Pin it to the toolbar</h3>
            <p>
              New extensions are often hidden in a menu. Pinning keeps Resolve’s icon next to the
              address bar so you can open it with one click.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                {b('Chrome and Brave:')} select the puzzle-piece {b('Extensions')} button to the
                right of the address bar, then the pin next to {b('Resolve')}.
              </li>
              <li>
                {b('Edge:')} select the puzzle-piece {b('Extensions')} button, then the eye icon
                next to {b('Resolve')} ({b('Show in toolbar')}).
              </li>
            </ul>
            <p>
              Select the Resolve icon to open its {b('popup')}, the small window used throughout
              this guide. Its {b('Settings')} button at the bottom opens the full settings page.
            </p>
            <Note>
              Updating later: download the new version, replace the contents of your Resolve folder
              with the new files, then press the reload arrow on Resolve’s card on the extensions
              page. Your settings are kept.
            </Note>
          </Section>

          <Section id="sign-in">
            <p>
              You need a free account for group website blocking and accountability. Media blurring
              and Focus Mode work without one.
            </p>
            <Steps>
              <li>Open the Resolve popup and choose {b('Sign in')}.</li>
              <li>
                A sign-in window opens. New to Resolve? Choose {b('Create an account')}, enter your
                email address and a password, and confirm the code sent to your email. Otherwise
                enter your details and choose {b('Sign in')}.
              </li>
              <li>The window closes by itself and the popup shows that you are signed in.</li>
              <li>
                The first time you open the{' '}
                <Link href="/dashboard" className="underline underline-offset-4">
                  dashboard
                </Link>
                , choose a {b('Display name')} (shown to your group, not your email) and select{' '}
                {b('Continue to my dashboard')}.
              </li>
            </Steps>
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <Shot
                src="sign-in.png"
                width={440}
                height={500}
                alt="The Resolve sign-in form with Email address and Password fields, a Sign in button and a Create an account link."
                caption="The sign-in window. It follows your device’s light or dark setting."
              />
              <Shot
                narrow
                src="popup-ready.png"
                width={320}
                height={833}
                alt="The Resolve popup when ready: Focus Mode off, signed in, Active group set to Grace Fellowship, Website blocking on, and a Protection list showing Media blurring, Website blocking and Blocked-visit alerts."
                caption="A ready popup, with demo data. Your email appears where it says you@example.com."
              />
            </div>
            <Expect>
              {b('Signed in as')} your email, an {b('Active group')} once you belong to one, and{' '}
              {b('Website blocking: on')}. Under {b('Protection')}, a green dot means a feature is
              on.
            </Expect>
            <Note>
              If you belong to several groups, choose the one this browser protects for under{' '}
              {b('Active group')}. Its blocked websites apply straight away.
            </Note>
          </Section>

          <Section id="blurring">
            <p>
              {b('Optional.')} Resolve can blur explicit images and video frames as pages load. An
              AI model packaged inside the extension checks each image on your own computer. Images
              are never uploaded, stored or shared.
            </p>
            <Steps>
              <li>
                In the popup choose {b('Settings')}, then under {b('Media blurring')} turn on{' '}
                {b('Blur sensitive images and videos')}.
              </li>
              <li>
                Your browser asks to let Resolve read and change data on the sites you visit. Choose{' '}
                {b('Allow')}: blurring needs to see the images on each page. If you decline,
                blurring stays off.
              </li>
              <li>
                Choose a {b('Sensitivity')}: {b('Strict')}, {b('Balanced')} (recommended) or{' '}
                {b('Relaxed')}.
              </li>
            </Steps>
            <Shot
              src="blur-settings.png"
              width={624}
              height={500}
              alt="The Media blurring settings: Blur sensitive images and videos turned on, Status On, Sensitivity options Strict, Balanced (selected) and Relaxed, and Media that can’t be checked set to Keep it blurred (safer)."
              caption="Media blurring turned on with the recommended Balanced sensitivity."
            />
            <p>
              What you will see: images start blurred and clear within a moment once they are
              checked. Anything judged explicit stays blurred. Some videos and images do not let
              extensions read them; under {b('Media that can’t be checked')} you decide whether they
              stay blurred (safer) or are shown.
            </p>
            <Note>
              The model makes mistakes in both directions. If too much or too little is blurred,
              change the sensitivity.
            </Note>
          </Section>

          <Section id="focus">
            <p>
              Focus Mode is a personal timer that blocks distracting websites for a set time. It
              stays in your browser: it sends nothing to Resolve, needs no account, and never alerts
              anyone.
            </p>
            <Steps>
              <li>
                In the popup, under {b('Focus Mode')}, choose a duration: {b('15')}, {b('25')},{' '}
                {b('30')}, {b('45')}, {b('60')} minutes, or {b('Custom')} (5 to 240).
              </li>
              <li>
                Facebook, Instagram, X, TikTok and Reddit are always included. Optionally also
                select {b('YouTube')}, {b('Netflix')} or {b('Twitch')}.
              </li>
              <li>
                Choose {b('Start Focus')}. The first time, your browser may ask for access to these
                websites; allowing it lets Resolve show its Focus page instead of the browser’s
                plain error page.
              </li>
            </Steps>
            <div className="grid items-start gap-6 sm:grid-cols-[20rem_1fr]">
              <Shot
                narrow
                src="focus-running.png"
                width={320}
                height={312}
                alt="The Focus Mode panel while running: the On badge, a large 24:58 countdown, a progress bar, 5 sites blocked, the end time, and an End early link."
                caption="A running session shows the time left and when it ends."
              />
              <div className="space-y-4">
                <p>
                  {b('When the timer ends,')} Focus Mode turns off by itself, even if the popup is
                  closed or the computer slept, and the websites open normally again.
                </p>
                <p>
                  {b('Emergency exit.')} To stop early, choose {b('End early')} and type exactly{' '}
                  <span className="font-medium">Yes, this is an emergency.</span> (pasting is turned
                  off), then {b('Continue')}. A last question asks if you are sure: choose{' '}
                  {b('Yes — End Focus Mode')}, or {b('No — Keep Focusing')}.
                </p>
              </div>
            </div>
            <figure>
              <video
                controls
                preload="none"
                playsInline
                poster="/tutorial/focus-mode-poster.jpg"
                width={720}
                height={624}
                className="bg-muted h-auto w-full max-w-[30rem] rounded-2xl"
                aria-describedby="focus-video-steps"
              >
                <source src="/tutorial/focus-mode.mp4" type="video/mp4" />
                <track
                  kind="captions"
                  src="/tutorial/focus-mode.vtt"
                  srcLang="en"
                  label="English"
                  default
                />
              </video>
              <figcaption
                id="focus-video-steps"
                className="text-muted-foreground mt-3 text-sm leading-relaxed"
              >
                Video, 14 seconds, no sound: choose 15 minutes and Start Focus; the countdown
                starts; End early, type the phrase, Continue; Yes — End Focus Mode; Focus Mode is
                off again.
              </figcaption>
            </figure>
            <Note>
              Focus Mode never changes your group’s blocked websites; those keep working whether
              Focus Mode is on or off.
            </Note>
          </Section>

          <Section id="groups">
            <p>
              A group is a small circle, such as a church small group or a few friends, whose
              members’ browsers block the same websites. You can belong to several groups.
            </p>
            <h3 className="text-xl font-semibold">Create a group</h3>
            <Steps>
              <li>
                Open the{' '}
                <Link href="/dashboard" className="underline underline-offset-4">
                  dashboard
                </Link>{' '}
                and choose {b('Groups')}.
              </li>
              <li>
                Under {b('Create a group')}, type a {b('New group name')} and select{' '}
                {b('Create group')}. You become its admin.
              </li>
            </Steps>
            <Shot
              src="groups.png"
              width={930}
              height={820}
              alt="The Groups page listing Grace Fellowship with an Admin badge, a Join a group form with an Invite link field and Open invite button, and a Create a group form with a New group name field and Create group button."
              caption="The Groups page: your groups, joining by link, and creating a group."
            />
            <h3 className="pt-2 text-xl font-semibold">Invite people or join a group</h3>
            <Steps>
              <li>
                Admins: open the group, choose the {b('Members')} tab, pick{' '}
                {b('People who can use the link')} and select {b('Create invite link')}. Copy the
                link (it is shown only once) and send it privately.
              </li>
              <li>
                Invited? Open the link, or paste it under {b('Join a group')} and choose{' '}
                {b('Open invite')}, then select {b('Join group')}. Joining shares nothing about you.
              </li>
            </Steps>
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <Shot
                src="group-members.png"
                width={930}
                height={926}
                alt="The Members tab: Ruth (Member) with Make admin and Remove buttons, Daniel (Admin), and the Invite people form with a new invite link hidden, a Copy button, and an active link showing 0 of 5 used."
                caption="Admins see members and create invite links. The link is hidden here."
              />
              <Shot
                src="invite.png"
                width={1000}
                height={644}
                alt="An invitation page titled Join Grace Fellowship explaining that joining shares nothing about you, with a Join group button."
                caption="What an invited person sees."
              />
            </div>
            <h3 className="pt-2 text-xl font-semibold">Block websites</h3>
            <p>
              On the group’s {b('Websites')} tab, type a website (for example example.com) under{' '}
              {b('Website to block')} and select {b('Block')}. It also blocks its subdomains.
              Essential services such as Gmail and Microsoft 365 always stay reachable.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                {b('Admins')} see and change the whole list, and choose a {b('Category')}:{' '}
                {b('Non-negotiable')} (a deliberate visit can alert partners who agreed) or{' '}
                {b('Additional')} (blocked, never sends alerts). They can {b('Remove')} websites or
                switch them with {b('Make additional')} / {b('Make non-negotiable')}.
              </li>
              <li>
                {b('Members')} can add websites for everyone, but cannot see or change the list.
              </li>
              <li>
                Several at once: open {b('Add several websites at once')} to paste a list or upload
                a spreadsheet, text or JSON file.
              </li>
            </ul>
            <Shot
              src="group-websites.png"
              width={930}
              height={820}
              alt="The Websites tab for an admin: the Website to block field with a Category menu and Block button, a Non-negotiable list containing twitch.tv and an Additional list containing reddit.com, each with Make additional or Make non-negotiable and Remove buttons."
              caption="An admin’s view of the Websites tab, with demo websites."
            />
            <Note>
              The extension checks for changes every 15 minutes. To apply a change right away,
              choose your group again under {b('Active group')} in the popup.
            </Note>
          </Section>

          <Section id="accountability">
            <p>
              {b('Optional and off by default.')} Accountability lets people you trust hear about it
              when you try to open a website your group treats as non-negotiable. Only you can turn
              it on, and admins cannot see or change your choice.
            </p>
            <Steps>
              <li>
                In the dashboard, open your group’s {b('Accountability')} tab and select{' '}
                {b('Turn on alerts')}.
              </li>
              <li>
                Read {b('Before you turn this on')}, then choose {b('Partners I choose')} and tick
                each person, or {b('Everyone in this group')}. Confirm with {b('Turn on alerts')}.
              </li>
              <li>
                Each partner opens the same tab and selects {b('Agree to receive')} next to your
                name. Nothing is sent to anyone who has not agreed. They can choose{' '}
                {b('Stop receiving')} at any time.
              </li>
              <li>
                In the extension’s {b('Settings')}, turn on{' '}
                {b('Alert my accountability partners about blocked visits')} and allow the browser
                permission it asks for. Chrome words it as “read your browsing history”: Resolve
                uses it only to notice when a blocked website was opened, keeps no history, and
                never sends which website it was.
              </li>
            </Steps>
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <Shot
                src="alerts-setup.png"
                width={930}
                height={1288}
                alt="The Accountability tab while turning on alerts: a Before you turn this on list, Who may receive them with Partners I choose selected, Ruth ticked under Your partners, and Turn on alerts and Cancel buttons."
                caption="Choosing who may receive your alerts."
              />
              <Shot
                src="partner-agreed.png"
                width={930}
                height={820}
                alt="A partner’s Accountability tab showing Daniel shares with you and a Stop receiving button."
                caption="The partner’s view after selecting Agree to receive."
              />
            </div>
            <Shot
              src="alerts-setting.png"
              width={624}
              height={224}
              alt="The Blocked-visit alerts setting in the extension, with Alert my accountability partners about blocked visits turned on and a note that alerts never name the website."
              caption="The extension’s alert setting, which must also be on."
            />
            <h3 className="pt-2 text-xl font-semibold">
              When partners are emailed, and what they read
            </h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                When you deliberately try to open a {b('non-negotiable')} website. Additional
                websites, Focus Mode, media blurring and blocks caused by a page or advert never
                send one. At most one alert per member every ten minutes.
              </li>
              <li>When you leave the group or are removed from it.</li>
              <li>
                The email gives your display name, the group’s name and that a restriction was
                triggered (or that you left). It {b('never names the website')}, never includes your
                browsing history, and says a blocked visit is not proof of intent.
              </li>
            </ul>
          </Section>

          <Section id="blocked">
            <p>
              When Resolve blocks a website, the website never loads. Which screen you see tells you
              why it was blocked. If a website is blocked by both your group and Focus Mode, you see
              your group’s screen.
            </p>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Shot
                src="focus-block.png"
                width={1000}
                height={860}
                alt="The Focus Mode screen: Focus Mode is On, 24:56 left, This website opens again when your Focus session ends, a short encouragement, and Close this Tab and Go Back buttons."
                caption={
                  <>
                    {b('Focus Mode is On')}: your own timer. It shows the time left. Choose{' '}
                    {b('Close this Tab')} or {b('Go Back')}, or end Focus Mode from the popup in an
                    emergency.
                  </>
                }
              />
              <Shot
                src="accountability-block.png"
                width={1000}
                height={860}
                alt="The Access Blocked screen: This page is blocked by Resolve. Please stay away from this website, a reflection question, a Scripture verse, and a Choose to Walk Away button."
                caption={
                  <>
                    {b('Access Blocked')}: your accountability group restricts this website. It
                    offers a reflection and Scripture or a Puritan quotation, and one button,{' '}
                    {b('Choose to Walk Away')}. There is no way past it.
                  </>
                }
              />
            </div>
            <Note>
              Neither screen names the website. These screens appear when blocked-visit alerts are
              turned on in the extension’s settings (Focus Mode’s screen also appears when you
              allowed site access). Otherwise your browser shows its own “This page has been
              blocked” page, and the website is still blocked.
            </Note>
          </Section>

          <Section id="help">
            <dl className="space-y-6">
              {[
                [
                  'I can’t find the Resolve icon.',
                  'Select the puzzle-piece Extensions button next to the address bar and pin Resolve (Edge: Show in toolbar). If Resolve is not listed, open your browser’s extensions page and check that it is installed and switched on.',
                ],
                [
                  'Resolve disappeared or shows an error on the extensions page.',
                  'The folder it was loaded from was moved or deleted. Unzip the download again into a folder you will keep, then choose Load unpacked again.',
                ],
                [
                  'My browser asks whether to turn off developer-mode extensions.',
                  'Because Resolve is installed with Load unpacked, some browsers show this reminder. Keep the extensions on: turning them off disables Resolve until you switch it back on from the extensions page.',
                ],
                [
                  'Sign-in didn’t finish.',
                  'If the sign-in window closed before you finished, or nothing changed, open the popup and choose Sign in again. Check that you confirmed your email for a new account, and that pop-up windows are not blocked. Signing in to this website does not sign in the extension; each signs in separately.',
                ],
                [
                  'The popup says it cannot reach the background service.',
                  'Press the reload arrow on Resolve’s card on the extensions page, then reopen the popup.',
                ],
                [
                  'The dashboard says the extension isn’t connected.',
                  'Install the extension in this same browser and sign in from its popup, then refresh the dashboard.',
                ],
                [
                  'A newly blocked website still opens.',
                  'The extension checks every 15 minutes. Choose your group again under Active group in the popup to check right away.',
                ],
                [
                  'I see the browser’s own blocked page, not Resolve’s.',
                  'The website is blocked either way. To see Resolve’s screens, turn on blocked-visit alerts in the extension’s settings, or allow site access when starting Focus Mode.',
                ],
              ].map(([q, a]) => (
                <div key={q} className="bg-muted/50 rounded-2xl p-5 sm:p-6">
                  <dt className="font-semibold">{q}</dt>
                  <dd className="text-muted-foreground mt-2">{a}</dd>
                </div>
              ))}
            </dl>
            <p>
              Still stuck? Read the{' '}
              <Link href="/faq" className="underline underline-offset-4">
                FAQ
              </Link>{' '}
              or email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </article>
      </div>
    </>
  );
}
