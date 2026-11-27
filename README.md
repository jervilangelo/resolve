<div align="center">

<a href="https://getresolved.site">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/logo/horizontal-dark-animated.svg">
    <img src="assets/branding/logo/horizontal-light-animated.svg" alt="Resolve" width="380">
  </picture>
</a>

<h3>A free browser extension for healthier online habits and voluntary accountability</h3>

Resolve blocks the websites your group chooses, blurs explicit images on your own device,<br>
gives you distraction-free Focus sessions, and lets people you trust encourage you.

**[Website](https://getresolved.site)** &nbsp;·&nbsp;
**[Download](https://getresolved.site/downloads)** &nbsp;·&nbsp;
**[Tutorial](https://getresolved.site/tutorial)** &nbsp;·&nbsp;
**[FAQ](https://getresolved.site/faq)**

<a href="https://github.com/jervilangelo/resolve/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/jervilangelo/resolve?style=flat-square&label=extension&color=334155"></a>
<img alt="Chrome, Edge and Brave" src="https://img.shields.io/badge/browsers-Chrome%20·%20Edge%20·%20Brave-334155?style=flat-square">
<img alt="Free, no ads" src="https://img.shields.io/badge/free-no%20ads-166534?style=flat-square">
<a href="LICENSE"><img alt="License: proprietary" src="https://img.shields.io/badge/license-proprietary-7f1d1d?style=flat-square"></a>

</div>

---

## What Resolve does

| Feature | What it does |
| --- | --- |
| **Website blocking for your group** | Your accountability group decides which websites its members' browsers block. Admins manage the list; members can add websites but cannot see it. Essential services such as Gmail and Microsoft 365 always stay reachable, and blocking keeps working offline. |
| **On-device image blurring** | Optional. An AI model packaged inside the extension checks images and video frames in your browser and blurs explicit ones. Nothing is uploaded. Three sensitivity levels. |
| **Focus Mode** | Block Facebook, Instagram, X, TikTok and Reddit (and optionally YouTube, Netflix or Twitch) for 5 to 240 minutes. It ends by itself; ending early takes two deliberate steps. Personal: no account needed, and it never alerts anyone. |
| **Voluntary accountability** | Off by default. Choose who may receive your alerts. Each partner must agree before they can receive an email. |
| **Two kinds of blocked page** | "Access Blocked" for group restrictions, with a reflection and Scripture, and "Focus Mode is On" with the time left. Neither names the site. |

The extension works with the free dashboard at [getresolved.site](https://getresolved.site), where
you create an account, start or join a group, and manage sharing.

## What emails an accountability partner

| What happens | When a consenting partner may get an email |
| --- | --- |
| You try to visit a blocked site | The attempt must qualify as deliberate, the group's admins must have marked the site **non-negotiable**, and **Blocked-visit alerts** must be enabled in the extension. Resolve sends at most one blocked-visit alert per member every ten minutes. |
| You leave a group, an admin removes you, or you delete your account | Eligible partners in each affected group may get the same **group departure** email. Account deletion ends your memberships and follows each group's existing sharing and consent choices. |
| You uninstall Resolve | An enrolled browser can report **removal** if it can reach Resolve when uninstalled. You and the recipient must both opt into removal alerts. |
| You disable Resolve in the browser, or the browser goes quiet | After **72 hours** without a check-in, an enrolled browser can trigger an **inactivity** email if you and the recipient both opted in. Disabling Resolve sends no immediate email. A closed, sleeping, or offline browser, or an unreported uninstall, can cause the same silence. |

To enroll a browser, enable **Tell my partners if Resolve is removed or stops checking in** in its extension settings. In the dashboard, both sides choose removal and inactivity separately under **Accountability → Removal and check-in alerts**.

Ordinary browsing, additional blocked sites, Focus Mode, and media blurring send no alerts. Turning off installation alerts in Resolve or signing out requests unenrollment. Emails never name the website or include browsing history. Installation emails give the member's display name and the time of removal or last check-in.

## Get started

1. **Download** the latest release from [getresolved.site/downloads](https://getresolved.site/downloads)
   or [GitHub Releases](https://github.com/jervilangelo/resolve/releases/latest).
2. **Install** it in Google Chrome, Microsoft Edge or Brave on a computer: unzip, turn on Developer
   mode on the extensions page, and choose **Load unpacked**.
3. **Sign in** from the Resolve popup, then create or join a group in the dashboard.

The [Tutorial](https://getresolved.site/tutorial) walks through every step with screenshots,
including pinning the icon, Focus Mode, accountability and
[fixing common problems](https://getresolved.site/tutorial#help). Firefox, phones and browser
stores are not available yet.

## Privacy

- Images and video frames are checked **on your device**; they are never uploaded.
- Resolve stores your account, display name, groups, the group's blocked websites and your sharing
  and consent choices, plus limited delivery records for alerts. It does **not** store or send the addresses, titles or history of pages you
  visit.
- Alerts contain your display name and a generic message, never the website. Blocked-visit and
  departure emails may name the group.
- Focus Mode stays in your browser and sends nothing.
- No ads, no tracking, no selling of data.

Details: [privacy policy](https://getresolved.site/privacy) and
[data inventory](docs/qa/DATA_INVENTORY.md).

## Limitations

- Any extension can be turned off or removed, and Resolve protects only the browser it is installed
  in. It supports honest people; it is not a lock.
- Blocked websites on a group's list can be inspected by someone technically determined on their own
  device.
- The image model makes mistakes in both directions, and some media cannot be checked.
- A blocked visit is not proof of intent, and not every block sends an alert (for example ones a page
  or advert caused).
- Resolve's own blocked pages appear when blocked-visit alerts are on (the Focus page also when you
  allowed site access); otherwise the browser shows its own block page.

## Why Resolve

Resolve grew out of a Christian commitment to careful internet use and mutual encouragement.
Anyone can use it to set boundaries and invite trusted people to support them.
Read more on the [About page](https://getresolved.site/about).
Resolve is free; [voluntary donations](https://getresolved.site/support) help keep it running.

## Documentation

| For | Read |
| --- | --- |
| Users | [Tutorial](https://getresolved.site/tutorial) · [FAQ](https://getresolved.site/faq) · [Privacy](https://getresolved.site/privacy) · [Terms](https://getresolved.site/terms) |
| Contributors | [Developing Resolve](docs/DEVELOPMENT.md) (layout, how it works, setup, tests, builds) · [Master plan](docs/MASTER_PLAN.md) · [Brand guidelines](docs/BRAND_GUIDELINES.md) |
| Maintainers | [Releasing and deploying](docs/RELEASING.md) · [Changelog](CHANGELOG.md) · [Runbooks](docs/qa/RUNBOOKS.md) · [Threat model](docs/qa/THREAT_MODEL.md) · [Progress log](docs/PROGRESS.md) |
| Future work | [Roadmap](docs/ROADMAP.md): deferred ideas, including a Windows desktop companion; to be revisited in 2027 |

Quick start for developers:

```bash
pnpm install
pnpm check      # format, headers, lint, types, unit tests
pnpm build      # website, extension and Lambdas
```

## Security and contact

Report security or privacy problems to **resolved.site@gmail.com** with "Security" in the subject,
and allow time for a fix before sharing publicly. Other questions: the same address or the
[Support page](https://getresolved.site/support).

## License

Copyright © Jervil Angelo De Leon. All rights reserved.

Resolve is proprietary and not open source. The code is public to read, but no permission is granted
to copy, modify, redistribute or reuse it without written permission. See [LICENSE](LICENSE) and
[COPYRIGHT_NOTICE.md](docs/COPYRIGHT_NOTICE.md). Third-party components keep their own licenses: the
bundled image model is [NSFWJS](https://github.com/infinitered/nsfwjs) by Infinite Red, Inc. (MIT),
shipped with its notice.
