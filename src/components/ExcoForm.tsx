"use client";

import { useState } from "react";
import { hasLogin, updateExco } from "@/lib/excos";
import { Card, Field, Notice } from "@/components/ui";
import type { ExcoMember, ExcoRole, RoleConfig } from "@/types";

interface Props {
  existing: ExcoMember; // edit-only — excos are made from the Youths page, or added as external admins on the Excos page
  roles: RoleConfig[]; // every role that can be assigned, including custom ones
  onSaved: () => void;
  onCancel: () => void;
}

export default function ExcoForm({ existing, roles, onSaved, onCancel }: Props) {
  const loggedIn = hasLogin(existing);
  const [name, setName] = useState(existing.name);
  const [phone, setPhone] = useState(existing.phone ?? "");
  const [gender, setGender] = useState(existing.gender ?? "");
  const [dob, setDob] = useState(existing.dob ?? "");
  const [unit, setUnit] = useState(existing.unit ?? "");
  const [email, setEmail] = useState(existing.email ?? "");
  const [title, setTitle] = useState(existing.title ?? "");
  const [role, setRole] = useState<ExcoRole>(existing.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");

    setSaving(true);
    setError(null);
    try {
      await updateExco(existing.id, {
        name,
        phone,
        gender: gender as ExcoMember["gender"],
        dob,
        unit,
        // External admins are always super_admin; their role isn't editable.
        role: existing.external ? existing.role : role,
        ...(existing.external ? { title } : {}),
        // Once someone has a login, their email is tied to it, so it's only
        // editable before they're invited (change it later via Firebase
        // Auth). Permissions come from the role, edited on the Roles &
        // Permissions page, not per-exco.
        ...(loggedIn ? {} : { email: email.trim() }),
      });
      onSaved();
    } catch {
      setError("Couldn't save this exco. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Edit exco">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </Field>
        {existing.youthId && (
          <p className="hint -mt-2">
            This exco is also on the youth roster. Name, phone, gender, birthday and unit are shared with their
            youth record: changing them here changes them there too.
          </p>
        )}

        {existing.external && (
          <Field label="Title" hint="How they're described, e.g. Church Pastor or Youth Pastor.">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </Field>
        )}

        <Field
          label="Email"
          hint={
            loggedIn
              ? "To change the email, update it in Firebase Auth."
              : "Not invited yet. You can set the email now or when you invite them."
          }
        >
          <input
            type="email"
            value={loggedIn ? existing.email ?? "" : email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loggedIn}
            className="input"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input" />
          </Field>
          <Field label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. Ushering"
              className="input"
            />
          </Field>
        </div>

        {existing.external ? (
          <Field label="Role" hint="External admins are always super admins.">
            <input value="Super Admin" disabled className="input" />
          </Field>
        ) : (
          <Field label="Role" hint="Changing the role changes what this exco can do. See Roles and permissions.">
            <select value={role} onChange={(e) => setRole(e.target.value as ExcoRole)} className="input">
              {roles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
