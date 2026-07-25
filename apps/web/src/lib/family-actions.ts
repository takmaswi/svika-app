"use server";

// Guardian mode's doors (batch V3): thin relays into the 0036 security
// definer RPCs. Invite codes never ride our query strings; the family page
// reads them back through my_family_links under the caller's own identity.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGuardianInvite(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_guardian_invite");
  redirect(error ? "/app/family?err=invite" : "/app/family");
}

export async function acceptGuardianInvite(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/app/family?err=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_guardian_invite", {
    p_code: code,
  });
  const outcome = data?.[0]?.outcome;
  if (error || !outcome || outcome === "invalid_code") {
    redirect("/app/family?err=invalid");
  }
  if (outcome === "rate_limited") redirect("/app/family?err=limited");
  redirect("/app/family?linked=1");
}

export async function revokeGuardianLink(formData: FormData): Promise<void> {
  const link = String(formData.get("link") ?? "");
  if (!link) redirect("/app/family");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_guardian_link", { p_link: link });
  redirect(error ? "/app/family?err=revoke" : "/app/family?ended=1");
}

export async function markTicketArrived(formData: FormData): Promise<void> {
  const ticket = String(formData.get("ticket") ?? "");
  if (!ticket) redirect("/app");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_ticket_arrived", {
    p_ticket: ticket,
  });
  redirect(error ? `/app/ticket/${ticket}?arrived=err` : `/app/ticket/${ticket}`);
}
