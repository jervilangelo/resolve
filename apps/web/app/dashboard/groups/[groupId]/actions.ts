/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use server';

import {
  accountabilityViewSchema,
  addedDomainSchema,
  createdInvitationSchema,
  domainTypeSchema,
  groupIdSchema,
  groupRoleSchema,
  groupSummarySchema,
  invitationIdSchema,
  updateGroupRequestSchema,
  updateSharingRequestSchema,
  userIdSchema,
} from '@resolve/contracts';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { ApiRequestError, api } from '@/lib/api';
import { serverEnv } from '@/lib/server-env';

export interface ActionState {
  error?: string;
  saved?: boolean;
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

export async function renameGroup(
  groupId: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id || !(formData instanceof FormData)) return INVALID;
  const input = updateGroupRequestSchema.safeParse({ name: formData.get('name') });
  if (!input.success) return { error: 'Enter a group name of 1–60 characters without < or >.' };
  try {
    await api(`/v1/groups/${id}`, groupSummarySchema, { method: 'PATCH', body: input.data });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath('/dashboard/groups', 'layout');
  return { saved: true };
}

export async function setMemberRole(
  groupId: string,
  userId: string,
  role: string,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  const user = parseId(userIdSchema, userId);
  const parsedRole = groupRoleSchema.safeParse(role);
  if (!id || !user || !parsedRole.success) return INVALID;
  try {
    await api(`/v1/groups/${id}/members/${user}`, empty, {
      method: 'PATCH',
      body: { role: parsedRole.data },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError && error.code === 'CONFLICT') {
      return { error: 'A group must keep at least one admin.' };
    }
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}

export async function dissolveGroup(groupId: string): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id) return INVALID;
  try {
    await api(`/v1/groups/${id}`, empty, { method: 'DELETE' });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath('/dashboard/groups', 'layout');
  redirect('/dashboard/groups');
}

export interface DomainFormState extends ActionState {
  message?: string;
}

export async function addBlockedDomain(
  groupId: string,
  _state: DomainFormState,
  formData: FormData,
): Promise<DomainFormState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id || !(formData instanceof FormData)) return INVALID;
  const domain = formData.get('domain');
  const type = formData.get('type');
  if (typeof domain !== 'string' || domain.trim() === '') return { error: 'Enter a website.' };
  const parsedType = type === null ? undefined : domainTypeSchema.safeParse(type);
  if (parsedType && !parsedType.success) return INVALID;
  try {
    const response = await api(`/v1/groups/${id}/domains`, z.unknown(), {
      method: 'POST',
      body: { domain: domain.trim(), ...(parsedType && { type: parsedType.data }) },
    });
    const added = addedDomainSchema.safeParse(response);
    revalidatePath(`/dashboard/groups/${id}`);
    if (added.success) {
      const exempt = added.data.exempted;
      return {
        saved: true,
        message:
          exempt.length > 0
            ? `Blocked ${added.data.domain}. ${exempt.join(', ')} stay reachable as essential services.`
            : `Blocked ${added.data.domain}.`,
      };
    }
    return { saved: true, message: 'Submission received.' };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError) {
      if (error.code === 'VALIDATION_FAILED') {
        return {
          error:
            'That website cannot be blocked. Enter a domain like example.com (not a link), and note that essential services cannot be blocked.',
        };
      }
      if (error.code === 'RATE_LIMITED') return { error: 'Too many submissions. Try again later.' };
      if (error.code === 'CONFLICT') {
        return { error: 'That website is already listed, or the list is full.' };
      }
    }
    return { error: GENERIC_ERROR };
  }
}

export async function removeBlockedDomain(groupId: string, domain: string): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id || typeof domain !== 'string' || !/^[a-z0-9.-]{1,253}$/.test(domain)) return INVALID;
  try {
    await api(`/v1/groups/${id}/domains/${domain}`, empty, { method: 'DELETE' });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}

export async function setBlockedDomainType(
  groupId: string,
  domain: string,
  type: string,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  const parsedType = domainTypeSchema.safeParse(type);
  if (
    !id ||
    !parsedType.success ||
    typeof domain !== 'string' ||
    !/^[a-z0-9.-]{1,253}$/.test(domain)
  ) {
    return INVALID;
  }
  try {
    await api(`/v1/groups/${id}/domains/${domain}`, empty, {
      method: 'PATCH',
      body: { type: parsedType.data },
    });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}

// ---- Accountability (§6): the caller's own choices only -------------------------------------------

export async function saveSharing(
  groupId: string,
  mode: unknown,
  recipientIds: unknown,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  const body = updateSharingRequestSchema.safeParse({ mode, recipientIds });
  if (!id) return INVALID;
  if (!body.success) {
    const none = mode === 'SELECTED' && Array.isArray(recipientIds) && recipientIds.length === 0;
    return {
      error: none
        ? 'Choose at least one member to share with.'
        : 'That sharing choice is not valid.',
    };
  }
  try {
    await api(`/v1/groups/${id}/accountability/sharing`, accountabilityViewSchema, {
      method: 'PUT',
      body: body.data,
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiRequestError && error.status === 422) {
      return { error: 'Someone you chose is no longer in the group. Reload and choose again.' };
    }
    if (error instanceof ApiRequestError && error.status === 429) {
      return { error: 'Too many changes in a short time. Please wait a while and try again.' };
    }
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return { saved: true };
}

export async function setAcceptAll(groupId: string, acceptAll: unknown): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  if (!id || typeof acceptAll !== 'boolean') return INVALID;
  try {
    await api(`/v1/groups/${id}/accountability/receiving`, accountabilityViewSchema, {
      method: 'PUT',
      body: { acceptAll },
    });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}

export async function setSenderConsent(
  groupId: string,
  senderId: string,
  accepted: unknown,
): Promise<ActionState> {
  const id = parseId(groupIdSchema, groupId);
  const sender = parseId(userIdSchema, senderId);
  if (!id || !sender || typeof accepted !== 'boolean') return INVALID;
  try {
    await api(`/v1/groups/${id}/accountability/senders/${sender}`, accountabilityViewSchema, {
      method: accepted ? 'PUT' : 'DELETE',
    });
  } catch (error) {
    unstable_rethrow(error);
    return { error: GENERIC_ERROR };
  }
  revalidatePath(`/dashboard/groups/${id}`);
  return {};
}
