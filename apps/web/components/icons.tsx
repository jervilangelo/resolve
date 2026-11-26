/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import type { ReactNode, SVGProps } from 'react';

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const ShieldIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
export const EyeOffIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.3 9.5 7a12.6 12.6 0 0 1-2.7 3.9M6.3 6.3C4.4 7.6 3.1 9.6 2.5 12c1 2.7 4.5 7 9.5 7 1.7 0 3.2-.5 4.5-1.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const UsersIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" />
    <path d="M15.5 4.9a3.25 3.25 0 0 1 0 6.2M18 14.8c1.6.8 2.7 2.6 3 5.2" />
  </Svg>
);
export const TimerIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 2M10 3h4M12 3v2.5" />
  </Svg>
);
export const LockIcon = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const DownloadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const ArrowRightIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const HeartIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </Svg>
);
export const MailIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);
export const BellIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);
export const GlobeIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z" />
  </Svg>
);

/** Simple monochrome marks for the supported browsers (not their trademarked logos). */
export const BrowserMark = ({
  browser,
  ...p
}: P & { browser: 'chrome' | 'edge' | 'brave' | 'firefox' }) => (
  <Svg {...p}>
    {browser === 'chrome' && (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3.25" />
        <path d="M12 8.75h8M9.2 13.6 5.2 6.8M14.8 13.6l-4 6.9" />
      </>
    )}
    {browser === 'edge' && (
      <>
        <path d="M20.5 13.5c0-5-3.8-9-8.5-9-4.7 0-8.5 3.8-8.5 8.5 0 4.9 4 7.5 7.5 7.5 3 0 5.3-1.3 6.5-3" />
        <path d="M20.5 13.5c-1.6 1.5-4.7 1.9-6.7.9-2-1-2.4-3.4-.8-4.7 1.6-1.2 4.3-.7 5.4 1" />
      </>
    )}
    {browser === 'brave' && (
      <>
        <path d="M8 3.5h8l2.5 3-1 9-5.5 5-5.5-5-1-9z" />
        <path d="m9.5 10 2.5 1.5 2.5-1.5M12 11.5v4" />
      </>
    )}
    {browser === 'firefox' && (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M7 7.5c.5 2 2 2.5 3.5 2.5 3 0 4.5 2 4.5 4a4 4 0 0 1-7.4 2.1" />
        <path d="M16.5 4.8c-.4 1.5-1.6 2.4-3 2.7" />
      </>
    )}
  </Svg>
);
