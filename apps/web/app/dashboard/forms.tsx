/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type FormState, createGroup, updateProfile } from './actions';

function Status({ state, savedText }: { state: FormState; savedText?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {state.error}
      </p>
    );
  }
  if (state.saved && savedText) {
    return (
      <p role="status" className="text-primary text-sm">
        {savedText}
      </p>
    );
  }
  return null;
}

export function ProfileForm({ displayName }: { displayName: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return (
    <form action={action} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName ?? ''}
          maxLength={60}
          required
          autoComplete="name"
        />
        <p className="text-muted-foreground text-xs">Shown to members of your groups.</p>
      </div>
      <Status state={state} savedText="Saved." />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}

export function CreateGroupForm({ idempotencyKey }: { idempotencyKey: string }) {
  const [state, action, pending] = useActionState(createGroup, {});
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="flex-1 space-y-2">
        <Label htmlFor="name">New group name</Label>
        <Input id="name" name="name" maxLength={60} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create group'}
      </Button>
      <div className="sm:basis-full">
        <Status state={state} />
      </div>
    </form>
  );
}
