"use client";

import { useState } from "react";
import { promoteYouthToExco } from "@/lib/excos";
import { formatPersonName } from "@/lib/formatName";
import { Card, Field, Notice } from "@/components/ui";
import type { Youth, ExcoRole } from "@/types";

const ROLES: { value: ExcoRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice President" },
  { value: "financial_secretary", label: "Financial Secretary" },
  { value: "secretary", label: "Secretary" },
  { value: "pr", label: "PR" },
];

interface Props {
  youth: Youth;
  onDone: () => void; // called after the admin dismisses the credentials screen
  onCancel: () => void;
}

export default function PromoteYouthForm({ youth, onDone, onCancel }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ExcoRole>("pr");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError("Email is required to create a login.");

    setSaving(true);
    setError(null);
    try {
      const { password } = await promoteYouthToExco(youth, email, role);
      setCredentials({ email, password });
    } catch (err: any) {
      setError(
        err?.code === "auth/email-already-in-use"
          ? "That email already has an account."
          : "Couldn't create this exco. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (credentials) {
    return (
      <Card title={`${formatPersonName(youth.name, youth.gender)} is now an exco`}>
        <div className="max-w-md space-y-4">
          <Notice tone="warning">
            Share these sign-in details with them directly. They won't be shown again. Encourage them to
            change the password after first sign-in.
          </Notice>
          <dl className="panel space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 text-muted">Email</dt>
              <dd className="font-medium">{credentials.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 text-muted">Password</dt>
              <dd className="font-mono font-medium">{credentials.password}</dd>
            </div>
          </dl>
          <button onClick={onDone} className="btn-primary">
            Done
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Make ${formatPersonName(youth.name, youth.gender)} an exco`}
      description="Name, phone and other details carry over from their youth record. Just add an email and a role."
    >
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as ExcoRole)} className="input">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creating…" : "Create exco"}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
