/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use server';

import {
  createdInvitationSchema,
  groupIdSchema,
  invitationIdSchema,
  userIdSchema,
} from '@resolve/contracts';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { ApiRequestError, api } from '@/lib/api';
import { serverEnv } from '@/lib/server-env';

export interface ActionState {
  error?: string;
  link?: string;
  expiresAt?: string;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const empty = z.unknown();

const INVALID = { error: 'Invalid request.' } as const;

/** Server actions are public endpoints: every argument is validated, never trusted. */
function parseId<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export async function createInvitation(
  groupId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id || !(formData instanceof FormData)) return INVALID;
  const maxUses = z.coerce.number().int().min(1).max(25).safeParse(formData.get('maxUses'));
  if (!maxUses.success) return { error: 'Choose how many people may use the link.' };
  try {
    const invitation = await api(`/v1/groups/${id}/invitations`, createdInvitationSchema, {
      method: 'POST',
      body: { maxUses: maxUses.data },
    });
    revalidatePath(`/dashboard/groups/${id}`);
    // The token goes in the fragment so it never reaches servers, logs or Referer headers.
    const link = new URL(`/invite#${invitation.token}`, serverEnv().NEXT_PUBLIC_SITE_URL);
    return { link: link.toString(), expiresAt: invitation.expiresAt };
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
}

export async function revokeInvitation(
  groupId: string,
  invitationId: string,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  const inv = parseId(invitationIdSchema, invitationId);
  if (!id || !inv) return INVALID;
  try {
    await api(`/v1/groups/${id}/invitations/${inv}`, empty, { method: 'DELETE' });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}

export async function removeMember(groupId: string, userId: string): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  const user = parseId(userIdSchema, userId);
  if (!id || !user) return INVALID;
  try {
    await api(`/v1/groups/${id}/members/${user}`, empty, { method: 'DELETE' });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}

export async function leaveGroup(groupId: string): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id) return INVALID;
  try {
    await api(`/v1/groups/${id}/leave`, empty, { method: 'POST' });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError && error.code === 'CONFLICT') {
      return { error: 'You are the only admin. Groups always need an admin.' };
    }
    return { error: GENERIC_ERROR };
  }
  revalidatePath('/dashboard/groups');
  redirect('/dashboard/groups');
}
