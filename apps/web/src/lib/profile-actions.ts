"use server";

// Server actions for the profile page: identity, saved trips, notification
// and voice prefs, and the consent gated emergency details. Emergency
// details never touch the table directly; the security definer RPCs are the
// only write path and they record consent in the same transaction.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EMERGENCY_CONSENT_VERSION, PARTNER_CONSENT_VERSION } from "@svika/shared";

const PROFILE = "/app/profile";
const PARTNER = "/app/partner";

/** Updates the rider's own name and phone (column level grant from 0001). */
export async function updateIdentity(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (fullName.length < 1 || fullName.length > 80) {
    redirect(`${PROFILE}?err=name`);
  }
  if (phone.length > 30) redirect(`${PROFILE}?err=phone`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone === "" ? null : phone })
    .eq("id", user.id);
  if (error) redirect(`${PROFILE}?err=identity`);
  redirect(`${PROFILE}?saved=identity`);
}

const PREF_COLUMNS = ["commute_alerts", "voice_en", "voice_sn"] as const;
type PrefColumn = (typeof PREF_COLUMNS)[number];

/** Flips one boolean pref; the row appears on first use. */
export async function setPref(formData: FormData): Promise<void> {
  const pref = String(formData.get("pref") ?? "");
  const value = String(formData.get("value") ?? "");
  if (!PREF_COLUMNS.includes(pref as PrefColumn)) redirect(PROFILE);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("rider_prefs").upsert(
    { rider_id: user.id, [pref]: value === "on" },
    { onConflict: "rider_id" },
  );
  if (error) redirect(`${PROFILE}?err=prefs`);
  redirect(PROFILE);
}

/**
 * Turns Svika Partner on or off. There is no partner column anywhere: the
 * switch appends to the partner-v1 consent stream, and the newest row in
 * that stream is the answer every server door reads (migration 0047). So
 * the history of who agreed to what, and when they changed their mind, is
 * the same append only record as every other consent, and turning it off
 * is one row rather than a deletion.
 *
 * The switch posts from two places (the profile card and the partner
 * screen) and returns to whichever asked.
 */
export async function setPartnerMode(formData: FormData): Promise<void> {
  const on = String(formData.get("value") ?? "") === "on";
  const back = String(formData.get("from") ?? "") === "profile" ? PROFILE : PARTNER;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("consent_records").insert({
    user_id: user.id,
    action: on ? "accepted" : "withdrawn",
    version: PARTNER_CONSENT_VERSION,
  });
  if (error) redirect(`${back}?err=partner`);
  redirect(`${back}?saved=${on ? "partner-on" : "partner-off"}`);
}

/** Renames a saved trip in place. */
export async function renameSavedTrip(formData: FormData): Promise<void> {
  const id = String(formData.get("trip") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!id || nickname.length < 1 || nickname.length > 40) {
    redirect(`${PROFILE}?err=nickname`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_trips")
    .update({ nickname })
    .eq("id", id);
  if (error) redirect(`${PROFILE}?err=trip`);
  redirect(PROFILE);
}

/** Removes a saved trip; RLS scopes the delete to the owner. */
export async function deleteSavedTrip(formData: FormData): Promise<void> {
  const id = String(formData.get("trip") ?? "");
  if (!id) redirect(PROFILE);

  const supabase = await createClient();
  const { error } = await supabase.from("saved_trips").delete().eq("id", id);
  if (error) redirect(`${PROFILE}?err=trip`);
  redirect(PROFILE);
}

/**
 * Saves emergency details through the RPC that records the consent in the
 * same transaction. The consent box is required in the form AND checked
 * here: no ticked box, no save.
 */
export async function saveEmergencyDetails(formData: FormData): Promise<void> {
  if (String(formData.get("consent") ?? "") !== "on") {
    redirect(`${PROFILE}?err=consent`);
  }
  const kinName = String(formData.get("kin_name") ?? "").trim();
  const kinPhone = String(formData.get("kin_phone") ?? "").trim();
  const aidName = String(formData.get("aid_name") ?? "").trim();
  const aidNumber = String(formData.get("aid_number") ?? "").trim();
  if (!kinName && !kinPhone && !aidName && !aidNumber) {
    redirect(`${PROFILE}?err=empty`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_emergency_details", {
    p_next_of_kin_name: kinName,
    p_next_of_kin_phone: kinPhone,
    p_medical_aid_name: aidName,
    p_medical_aid_number: aidNumber,
    p_consent_version: EMERGENCY_CONSENT_VERSION,
  });
  if (error) redirect(`${PROFILE}?err=emergency`);
  redirect(`${PROFILE}?saved=emergency`);
}

/** Removes the details and records the withdrawal, same transaction. */
export async function removeEmergencyDetails(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_emergency_details", {
    p_consent_version: EMERGENCY_CONSENT_VERSION,
  });
  if (error) redirect(`${PROFILE}?err=emergency`);
  redirect(`${PROFILE}?saved=removed`);
}
