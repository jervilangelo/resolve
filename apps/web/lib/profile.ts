/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

import 'server-only';
import { profileSchema } from '@resolve/contracts';
import { cache } from 'react';
import { api } from './api';

/** The signed-in user's profile, fetched once per request however many components ask. */
export const getProfile = cache(() => api('/v1/me', profileSchema));
