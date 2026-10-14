// Medication uploads, opening them, and the printed medication list.
// Every call runs assertCanManageClient first (edit_medical to upload,
// view_medical to open or print), then uses the service client. Files live
// in the private client-documents bucket (paths in med-files.ts) and open
// through a one-minute signed link.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "@/lib/clients/guards.server";
import { DENVER_TZ } from "@/lib/denver-date";
import {
  MEDICATION_FILE_BUCKET,
  MEDICATION_FILE_KINDS,
  isClientMedicationFile,
  medicationFilePath,
  medicationFileProblem,
} from "./med-files";
import { listMedications, type Sb } from "./meds-write";
import { medListFilename, renderMedListPdf, type MedListMed } from "./med-list-pdf";

type Storage = {
  from: (bucket: string) => {
    upload: (
      path: string,
      body: Uint8Array,
      o: { contentType: string; upsert: boolean },
    ) => Promise<{ error: { message: string } | null }>;
    createSignedUrl: (
      path: string,
      seconds: number,
    ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  };
};

async function admin(): Promise<{ db: Sb; storage: Storage }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    db: supabaseAdmin as unknown as Sb,
    storage: (supabaseAdmin as unknown as { storage: Storage }).storage,
  };
}

/** Signed in, the client exists, and the caller may do `action` for them. */
async function guardClient(
  context: { userId?: string | null; supabase?: unknown },
  db: Sb,
  clientId: string,
  action: "view_medical" | "edit_medical",
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const { data, error } = await db
    .from("clients")
    .select(
      "organization_id, first_name, last_name, date_of_birth, allergies, dysphagia, swallowing_alerts",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found.");
  const client = data as {
    organization_id: string;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
    allergies: string[] | null;
    dysphagia: boolean | null;
    swallowing_alerts: string[] | null;
  };
  await assertCanManageClient({
    supabase: context.supabase as Parameters<typeof assertCanManageClient>[0]["supabase"],
    actorId: context.userId,
    organizationId: client.organization_id,
    clientId,
    action,
  });
  return { userId: context.userId, client };
}

export const uploadMedicationFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        clientId: z.string().uuid(),
        kind: z.enum(MEDICATION_FILE_KINDS),
        fileName: z.string().trim().min(1).max(200),
        mime: z.string().max(100),
        // 10 MB of file is about 13.4 MB of base64.
        base64: z.string().min(1).max(14_000_000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { db, storage } = await admin();
    const { client } = await guardClient(context, db, data.clientId, "edit_medical");
    const bytes = Uint8Array.from(Buffer.from(data.base64, "base64"));
    const problem = medicationFileProblem(data.mime, bytes.byteLength);
    if (problem) throw new Error(problem);
    const path = medicationFilePath({
      orgId: client.organization_id,
      clientId: data.clientId,
      kind: data.kind,
      id: crypto.randomUUID(),
      fileName: data.fileName,
    });
    const { error } = await storage
      .from(MEDICATION_FILE_BUCKET)
      .upload(path, bytes, { contentType: data.mime, upsert: false });
    if (error) throw new Error(error.message);
    return { path };
  });

export const openMedicationFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ clientId: z.string().uuid(), path: z.string().min(1).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { db, storage } = await admin();
    const { client } = await guardClient(context, db, data.clientId, "view_medical");
    if (!isClientMedicationFile(data.path, client.organization_id, data.clientId))
      throw new Error("That file isn't one of this client's medication files.");
    const { data: signed, error } = await storage
      .from(MEDICATION_FILE_BUCKET)
      .createSignedUrl(data.path, 60);
    if (error || !signed) throw new Error(error?.message ?? "Couldn't open the file.");
    return { url: signed.signedUrl };
  });

function printedAt(now: Date): string {
  return now.toLocaleString("en-US", {
    timeZone: DENVER_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const printMedicationList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { db } = await admin();
    const { userId, client } = await guardClient(context, db, data.clientId, "view_medical");
    const [{ data: org }, { data: me }, meds] = await Promise.all([
      db.from("organizations").select("name").eq("id", client.organization_id).maybeSingle(),
      db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      listMedications(db, data.clientId),
    ]);
    const name = [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client";
    const swallow = [client.dysphagia ? "Yes" : null, ...(client.swallowing_alerts ?? [])].filter(
      Boolean,
    );
    const bytes = await renderMedListPdf(meds as unknown as MedListMed[], {
      provider: (org as { name?: string } | null)?.name || "Provider",
      client: name,
      dob: client.date_of_birth,
      allergies: client.allergies ?? [],
      swallowingRisk: swallow.length ? swallow.join(", ") : "None on file",
      printedBy: (me as { full_name?: string | null } | null)?.full_name || "Staff",
      printedAt: printedAt(new Date()),
    });
    return { pdfBase64: Buffer.from(bytes).toString("base64"), filename: medListFilename(name) };
  });
