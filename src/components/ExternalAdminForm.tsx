"use client";

import { useState } from "react";
import { createExternalAdmin, inviteExco } from "@/lib/excos";
import { Card, Field, Notice } from "@/components/ui";
import { InviteResult, inviteErrorMessage } from "@/components/InviteExcoForm";

interface Props {
  onDone: () => void; // after saving (or after dismissing the invite result)
  onCancel: () => void;
}

/**
 * Adds an external admin — someone who isn't on the youth roster, like
 * the church pastor or the youth pastor. They're always super admins.
 */
export default function ExternalAdminForm({ onDone, onCancel }: Props) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteNow, setInviteNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the record is saved, so a failed invite is retried on the
  // same record instead of creating a duplicate.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; email: string; password: string; emailSent: boolean } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");

    setSaving(true);
    setError(null);

    let id = createdId;
    if (!id) {
      try {
        id = await createExternalAdmin({ name, title, email, phone });
        setCreatedId(id);
      } catch {
        setError("Couldn't add this admin. Try again.");
        setSaving(false);
        return;
      }
    }

    if (!inviteNow) {
      setSaving(false);
      return onDone();
    }

    try {
      const { password, emailSent } = await inviteExco({ id, uid: null }, email);
      setResult({ name: name.trim(), email: email.trim(), password, emailSent });
    } catch (err) {
      setError(`${inviteErrorMessage(err)} ${name.trim()} has been saved, so you can fix the email and try again, or close and invite them later from the Excos page.`);
    } finally {
      setSaving(false);
    }
  }

  if (result) return <InviteResult {...result} onDone={onDone} />;

  return (
    <Card
      title="Add an external admin"
      description="For people outside the youth roster, such as the church pastor or the youth pastor. They get full super admin access."
    >
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </Field>
        <Field label="Title (optional)" hint="How they're described, e.g. Church Pastor or Youth Pastor.">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
        </Field>
        <Field label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inviteNow}
            onChange={(e) => setInviteNow(e.target.checked)}
            className="h-4 w-4 accent-rccg-green-600"
          />
          Invite them now (create their login)
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : inviteNow ? "Add and invite" : "Add admin"}
          </button>
          <button type="button" onClick={createdId ? onDone : onCancel} className="btn-secondary">
            {createdId ? "Close" : "Cancel"}
          </button>
        </div>
      </form>
    </Card>
  );
}
