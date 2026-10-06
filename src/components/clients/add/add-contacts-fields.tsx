import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { AddClientForm, ContactPerson, FilledField } from "@/lib/clients/create";
import { Field, FromPcspTag } from "./add-identity-fields";

function PersonFields({
  person,
  onChange,
  required,
  withRelationship,
  withCompany,
}: {
  person: ContactPerson;
  onChange: (p: ContactPerson) => void;
  required?: boolean;
  withRelationship?: boolean;
  withCompany?: boolean;
}) {
  const set = (patch: Partial<ContactPerson>) => onChange({ ...person, ...patch });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={`Name${required ? " *" : ""}`}>
        <Input
          value={person.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={200}
        />
      </Field>
      <Field label={`Phone${required ? " *" : ""}`}>
        <Input
          value={person.phone}
          onChange={(e) => set({ phone: e.target.value })}
          maxLength={50}
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={person.email}
          onChange={(e) => set({ email: e.target.value })}
          maxLength={200}
        />
      </Field>
      {withRelationship && (
        <Field label="Relationship">
          <Input
            value={person.relationship}
            onChange={(e) => set({ relationship: e.target.value })}
            maxLength={100}
          />
        </Field>
      )}
      {withCompany && (
        <Field label="Company">
          <Input
            value={person.company}
            onChange={(e) => set({ company: e.target.value })}
            maxLength={200}
          />
        </Field>
      )}
    </div>
  );
}

/** Support Coordinator and guardian; both are saved as client contacts. */
export function AddContactsFields({
  form,
  set,
  filled,
}: {
  form: AddClientForm;
  set: (patch: Partial<AddClientForm>) => void;
  filled: FilledField[];
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">
          Support Coordinator
          <FromPcspTag show={filled.includes("support_coordinator")} />
        </h4>
        <PersonFields
          person={form.support_coordinator}
          onChange={(p) => set({ support_coordinator: p })}
          withCompany
        />
      </section>
      <section className="space-y-2 rounded-lg border border-border p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={form.is_own_guardian}
            onCheckedChange={(v) => set({ is_own_guardian: !!v })}
          />
          Client is their own guardian
        </label>
        {!form.is_own_guardian && (
          <PersonFields
            person={form.guardian}
            onChange={(p) => set({ guardian: p })}
            required
            withRelationship
          />
        )}
      </section>
    </div>
  );
}
