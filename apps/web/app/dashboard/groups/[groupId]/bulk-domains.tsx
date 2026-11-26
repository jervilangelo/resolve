/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  BULK_CHUNK,
  type BulkParse,
  MAX_BULK_DOMAINS,
  MAX_BULK_FILE_BYTES,
  entriesFromText,
  parseEntries,
} from '@/lib/bulk-domains';
import { type BulkDomainResult, addBlockedDomains } from './actions';

const ACCEPT = '.txt,.csv,.tsv,.json,.xlsx,text/plain,text/csv,application/json';

/** Every cell of every sheet in an Excel workbook (the reader loads only when one is chosen). */
async function xlsxEntries(file: File): Promise<string[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  return sheets.flatMap((sheet) =>
    sheet.data.flat().map((cell) => (typeof cell === 'string' ? cell : '')),
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${String(n)} ${n === 1 ? one : many}`;
}

function Summary({ result, isAdmin }: { result: BulkDomainResult; isAdmin: boolean }) {
  const lines: string[] = [];
  if (result.added > 0) {
    lines.push(`${isAdmin ? 'Blocked' : 'Submitted'} ${plural(result.added, 'website')}.`);
  }
  if (result.existing > 0) {
    lines.push(
      `${plural(result.existing, 'website was', 'websites were')} already listed (or the list is full).`,
    );
  }
  if (result.exempted.length > 0) {
    lines.push(`${result.exempted.join(', ')} stay reachable as essential services.`);
  }
  return (
    <div className="space-y-1 text-sm" role="status">
      {lines.map((line) => (
        <p key={line} className="text-primary">
          {line}
        </p>
      ))}
      {result.rejected.length > 0 && (
        <p className="text-muted-foreground">
          Not accepted (not a website, or an essential service): {result.rejected.join(', ')}
        </p>
      )}
      {result.error && (
        <p role="alert" className="text-destructive">
          {result.error}
          {result.notSent.length > 0 && ` Not sent: ${plural(result.notSent.length, 'website')}.`}
        </p>
      )}
    </div>
  );
}

/** Several websites at once: pasted (one per line, or separated by commas) or from a file. */
export function BulkDomainForm({
  groupId,
  isAdmin,
  room,
}: {
  groupId: string;
  isAdmin: boolean;
  /** Admins: how many more websites the list can hold (members cannot know). */
  room?: number;
}) {
  const textId = useId();
  const fileId = useId();
  const typeId = useId();
  const [text, setText] = useState('');
  const [fileParse, setFileParse] = useState<(BulkParse & { name: string }) | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [type, setType] = useState<'ADDITIONAL' | 'NON_NEGOTIABLE'>('ADDITIONAL');
  const [result, setResult] = useState<BulkDomainResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => fileParse ?? parseEntries(entriesFromText(text)), [fileParse, text]);

  function clearFile() {
    setFileParse(null);
    setFileKey((k) => k + 1); // resets the file input
  }

  async function onFile(file: File | undefined) {
    setFileError(null);
    setResult(null);
    if (!file) {
      setFileParse(null);
      return;
    }
    if (file.size > MAX_BULK_FILE_BYTES) {
      clearFile();
      setFileError('That file is too large. Use a file under 2 MB.');
      return;
    }
    try {
      const entries = file.name.toLowerCase().endsWith('.xlsx')
        ? await xlsxEntries(file)
        : entriesFromText(await file.text());
      setFileParse({ ...parseEntries(entries), name: file.name });
    } catch {
      clearFile();
      setFileError('That file could not be read. Use a .txt, .csv, .json or .xlsx file.');
    }
  }

  // An admin's batch never runs past the list's capacity (each submission is charged).
  const capped = room === undefined ? parsed.domains : parsed.domains.slice(0, Math.max(0, room));
  const overCapacity = parsed.domains.length - capped.length;

  function submit() {
    if (capped.length === 0) return;
    const domains = capped;
    startTransition(async () => {
      const total: BulkDomainResult = {
        added: 0,
        existing: 0,
        rejected: [],
        notSent: [],
        exempted: [],
      };
      for (let i = 0; i < domains.length; i += BULK_CHUNK) {
        const chunk = domains.slice(i, i + BULK_CHUNK);
        let outcome: BulkDomainResult;
        try {
          outcome = await addBlockedDomains(groupId, { domains: chunk, ...(isAdmin && { type }) });
        } catch {
          outcome = {
            added: 0,
            existing: 0,
            rejected: [],
            notSent: chunk,
            exempted: [],
            error: 'Something went wrong. Please try again.',
          };
        }
        total.added += outcome.added;
        total.existing += outcome.existing;
        total.rejected.push(...outcome.rejected);
        total.exempted = [...new Set([...total.exempted, ...outcome.exempted])];
        if (outcome.error) {
          total.error = outcome.error;
          total.notSent = [...outcome.notSent, ...domains.slice(i + BULK_CHUNK)];
          break;
        }
      }
      setResult(total);
      clearFile();
      // Keep only what was not sent, so trying again never re-submits blocked websites.
      setText(total.notSent.join('\n'));
    });
  }

  const count = capped.length;
  const verb = isAdmin ? 'Block' : 'Submit';
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={textId}>Websites, one per line</Label>
        <textarea
          id={textId}
          value={text}
          disabled={pending || fileParse !== null}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={5}
          spellCheck={false}
          placeholder={'example.com\nanother-site.net'}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={fileId}>Or upload a file</Label>
        <input
          key={fileKey}
          id={fileId}
          type="file"
          accept={ACCEPT}
          disabled={pending}
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <p className="text-muted-foreground text-xs">
          A spreadsheet (.xlsx or .csv), a text file, or JSON such as{' '}
          <code className="font-mono">[&quot;example.com&quot;]</code>. Links are reduced to their
          website. Up to {String(MAX_BULK_DOMAINS)} websites at a time.
        </p>
        {fileError && (
          <p role="alert" className="text-destructive text-sm">
            {fileError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor={typeId}>Category for all</Label>
            <select
              id={typeId}
              value={type}
              disabled={pending}
              onChange={(e) => {
                setType(e.target.value === 'NON_NEGOTIABLE' ? 'NON_NEGOTIABLE' : 'ADDITIONAL');
              }}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="ADDITIONAL">Additional</option>
              <option value="NON_NEGOTIABLE">Non-negotiable</option>
            </select>
          </div>
        )}
        <Button type="button" disabled={pending || capped.length === 0} onClick={submit}>
          {pending
            ? 'Adding…'
            : count === 0
              ? `${verb} websites`
              : `${verb} ${plural(count, 'website')}`}
        </Button>
      </div>
      {(count > 0 || parsed.skipped > 0) && !result && (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {fileParse ? `${fileParse.name}: ` : ''}
          {plural(count, 'website')} found
          {parsed.skipped > 0 ? `, ${plural(parsed.skipped, 'entry', 'entries')} skipped` : ''}
          {overCapacity > 0
            ? `, ${String(overCapacity)} left out (the list has room for ${String(Math.max(0, room ?? 0))} more)`
            : ''}
          {parsed.overflow > 0
            ? `, ${String(parsed.overflow)} more left out (limit ${String(MAX_BULK_DOMAINS)})`
            : ''}
          .{' '}
          {fileParse && (
            <button type="button" className="underline" onClick={clearFile}>
              Clear file
            </button>
          )}
        </p>
      )}
      {result && <Summary result={result} isAdmin={isAdmin} />}
    </div>
  );
}
