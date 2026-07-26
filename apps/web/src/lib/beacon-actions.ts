"use server";

// The demand beacon (batch V8), rider side. A signal and nothing more: the
// rider says they are waiting, and conductors on that route see a count. No
// conductor can respond to it inside Svika, by design (migration 0044).
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function raiseBeacon(formData: FormData): Promise<void> {
  const route = String(formData.get("route") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const stop = String(formData.get("stop") ?? "");
  if (!route || !stop || (direction !== "outbound" && direction !== "inbound")) {
    redirect("/app/kombis");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("raise_beacon", {
    p_route: route,
    p_direction: direction,
    p_stop: stop,
  });
  const outcome = error
    ? "error"
    : ((data as { outcome: string }[] | null)?.[0]?.outcome ?? "error");
  redirect(`/app/kombis?beacon=${outcome}`);
}

export async function withdrawBeacon(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("withdraw_beacon");
  redirect("/app/kombis?beacon=withdrawn");
}
