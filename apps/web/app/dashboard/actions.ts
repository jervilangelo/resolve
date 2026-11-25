/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use server';

import {
  createGroupRequestSchema,
  groupSummarySchema,
  idempotencyKeySchema,
  profileSchema,
  updateProfileRequestSchema,
} from '@resolve/contracts';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { ApiRequestError, api } from '@/lib/api';
import { authConfig } from '@/lib/auth';
import { clearCookies } from '@/lib/session';

export interface FormState {
  error?: string;
  saved?: boolean;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function errorMessage(error: unknown, invalid: string): string {
  if (error instanceof ApiRequestError && error.code === 'VALIDATION_FAILED') return invalid;
  return GENERIC_ERROR;
}

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const input = updateProfileRequestSchema.safeParse({ displayName: formData.get('displayName') });
  if (!input.success) {
    return {
      error: 'Enter a name of 1–60 characters, without < or >, links, web or email addresses.',
    };
  }
  try {
    await api('/v1/me', profileSchema, { method: 'PATCH', body: input.data });
  } catch (error) {
    unstable_rethrow(error); // let sign-in redirects through
    return { error: errorMessage(error, 'That name is not allowed.') };
  }
  revalidatePath('/dashboard', 'layout');
  return { saved: true };
}

export async function createGroup(_state: FormState, formData: FormData): Promise<FormState> {
  const input = createGroupRequestSchema.safeParse({ name: formData.get('name') });
  if (!input.success) return { error: 'Enter a group name of 1–60 characters without < or >.' };
  // Rendered into the form once, so a double submit or retry creates only one group.
  const key = idempotencyKeySchema.safeParse(formData.get('idempotencyKey'));
  let groupId: string;
  try {
    const group = await api('/v1/groups', groupSummarySchema, {
      method: 'POST',
      body: input.data,
      headers: key.success ? { 'idempotency-key': key.data } : {},
    });
    groupId = group.groupId;
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error, 'That group name is not allowed.') };
  }
  revalidatePath('/dashboard/groups');
  redirect(`/dashboard/groups/${groupId}`);
}

/**
 * Deletes the account: leaves every group (departure alerts follow the user's own sharing),
 * dissolves groups only they belong to, deletes their data and sign-in, then signs out here.
 */
export async function deleteAccount(_state: FormState, formData: FormData): Promise<FormState> {
  if (formData.get('confirm') !== 'DELETE') return { error: 'Type DELETE to confirm.' };
  try {
    await api('/v1/me', z.unknown(), { method: 'DELETE' });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError && error.code === 'CONFLICT') {
      return {
        error:
          'Deletion stopped: you are the only admin of a group that has other members (or another ' +
          'admin just left). Make someone else an admin or dissolve the group, then try again. ' +
          'Groups you had already left stay left.',
      };
    }
    return { error: GENERIC_ERROR };
  }
  const { secure, names } = authConfig();
  clearCookies(await cookies(), secure, names.session, names.refresh);
  // The account no longer exists; the signed-out page completes the sign-out.
  redirect('/auth/signed-out');
}
