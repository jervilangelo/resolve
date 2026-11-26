/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import { permanentRedirect } from 'next/navigation';

/** The setup guide moved to the Tutorial; old links keep working. */
export default function GettingStartedPage() {
  permanentRedirect('/tutorial');
}
