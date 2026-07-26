"use server";

// Server actions for the rider flows. Every money move goes through the
// security definer RPCs (the ledger is the only money path); these actions
// only relay the signed-in user's intent, never touch tables directly.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchNetwork } from "@/lib/network";
import { loadPlaces, resolvePlaceQuery } from "@/lib/geocode/search";
import {
  CONSENT_VERSION,
  dollarsToCents,
  planToPoint,
  planTrip,
  type RideLeg,
} from "@svika/shared";

/** Appends the accept record that opens the app (see the /app layout gate). */
export async function acceptConsent(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("consent_records").insert({
    user_id: user.id,
    action: "accepted",
    version: CONSENT_VERSION,
  });
  if (error) redirect("/consent?err=1");
  redirect("/app");
}

/**
 * The delete action on the your data page. The ledger is append only, so
 * this anonymises instead of erasing: the RPC strips name and phone, drops
 * saved trips and appends a consent withdrawal, then the session ends and
 * the consent gate stays closed until a fresh accept.
 */
export async function deleteMyData(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymise_me");
  if (error) redirect("/app/privacy?err=1");
  await supabase.auth.signOut();
  redirect("/");
}

export interface PurchasedTicket {
  ticketId: string;
  boardCode: string;
  fareCents: number;
}

/**
 * Buys one ticket per ride leg of the planned trip (wallet debit or cash
 * reservation), then lands on the rider home where the codes are shown.
 * Legs are re-planned server side from the stop pair: the client only sends
 * where it wants to go and how to pay, never fares or routes. A destination
 * first booking (D1) sends the place NAME instead of a stop id; the server
 * re-resolves it against the local corpus and re-plans to the point, so
 * coordinates and walking tails are never trusted from the client either.
 * The tail is recorded against the final leg's ticket for the in ride walk
 * cue and, later, D2's planned versus actual comparison.
 */
export async function bookTrip(formData: FormData): Promise<void> {
  const fromStop = String(formData.get("from") ?? "");
  const toStop = String(formData.get("to") ?? "");
  const destName = String(formData.get("dest") ?? "");
  const payment = String(formData.get("payment") ?? "wallet");
  if (!fromStop || (!toStop && !destName)) redirect("/app");
  if (payment !== "wallet" && payment !== "cash") redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);
  const back = destName
    ? `/app/plan?from=${fromStop}&to=${encodeURIComponent(destName)}`
    : `/app/plan?from=${fromStop}&to=${toStop}`;

  let plan: ReturnType<typeof planTrip> = null;
  let tail: { destName: string; lng: number; lat: number; meters: number } | null =
    null;
  if (destName) {
    const place = resolvePlaceQuery(loadPlaces(), destName).match;
    if (!place) redirect(`${back}&err=noroute`);
    const pointPlan = planToPoint(network, fromStop, place);
    if (!pointPlan) redirect(`${back}&err=noroute`);
    plan = pointPlan.plan;
    tail = {
      destName: place.name,
      lng: place.lng,
      lat: place.lat,
      meters: pointPlan.walkTail.meters,
    };
  } else {
    plan = planTrip(network, fromStop, toStop);
  }
  if (!plan) redirect(`${back}&err=noroute`);

  const rideLegs = plan.legs.filter((l): l is RideLeg => l.type === "ride");
  let lastTicketId: string | null = null;
  for (const leg of rideLegs) {
    const { data, error } = await supabase.rpc("purchase_ticket", {
      p_route: leg.routeId,
      p_direction: leg.direction,
      p_from_stop: leg.boardStopId,
      p_to_stop: leg.alightStopId,
      p_payment: payment,
    });
    if (error) {
      const err = error.message.includes("insufficient") ? "balance" : "purchase";
      redirect(`${back}&err=${err}`);
    }
    lastTicketId =
      (data as { ticket_id: string }[] | null)?.[0]?.ticket_id ?? lastTicketId;
  }

  // the walking tail rides the final leg's ticket; a failed insert never
  // blocks the booked ride, the guidance just has no walk cue
  if (tail && lastTicketId) {
    await supabase.from("trip_walk_tails").insert({
      ticket_id: lastTicketId,
      rider_id: user.id,
      dest_name: tail.destName,
      dest_lng: tail.lng,
      dest_lat: tail.lat,
      walk_meters: tail.meters,
    });
  }

  redirect("/app?booked=1");
}

/**
 * Saves a nicknamed trip ("Town trip") as a home quick pick. Plain rider
 * owned data under RLS; saving the same stop pair again just renames it.
 */
export async function saveTrip(formData: FormData): Promise<void> {
  const fromStop = String(formData.get("from") ?? "");
  const toStop = String(formData.get("to") ?? "");
  // M4 (the D1 follow-up): a saved trip can now end at a named place instead
  // of a stop. The destination's own name and coordinates are stored, which
  // is exactly what the planner needs to rebuild the same plan later.
  const destName = String(formData.get("dest") ?? "").trim();
  const destLat = Number(formData.get("destLat"));
  const destLng = Number(formData.get("destLng"));
  const nickname = String(formData.get("nickname") ?? "").trim();
  const toParam = toStop || destName;
  const back = `/app/plan?from=${encodeURIComponent(fromStop)}&to=${encodeURIComponent(toParam)}`;
  const toPlace = !toStop && destName !== "";
  if (!fromStop || !toParam || fromStop === toStop) redirect("/app");
  if (toPlace && !(Number.isFinite(destLat) && Number.isFinite(destLng))) {
    redirect(`${back}&err=save`);
  }
  if (nickname.length < 1 || nickname.length > 40) redirect(`${back}&err=nickname`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let error;
  if (toPlace) {
    // A place trip's uniqueness lives in a PARTIAL index (a stop pair trip
    // has a null dest_name and must not collide with it), and PostgREST
    // cannot infer ON CONFLICT from a partial index. So saving the same place
    // again replaces the old row rather than upserting onto it. Plain rider
    // owned data under RLS, no money, so a replace is safe.
    await supabase
      .from("saved_trips")
      .delete()
      .eq("rider_id", user.id)
      .eq("from_stop_id", fromStop)
      .eq("dest_name", destName);
    ({ error } = await supabase.from("saved_trips").insert({
      rider_id: user.id,
      from_stop_id: fromStop,
      to_stop_id: null,
      dest_name: destName,
      dest_lat: destLat,
      dest_lng: destLng,
      nickname,
    }));
  } else {
    ({ error } = await supabase.from("saved_trips").upsert(
      {
        rider_id: user.id,
        from_stop_id: fromStop,
        to_stop_id: toStop,
        nickname,
      },
      { onConflict: "rider_id,from_stop_id,to_stop_id" },
    ));
  }
  if (error) redirect(`${back}&err=save`);
  redirect(`${back}&saved=1`);
}

/** Parks wallet credit in escrow under a claim code (shown on the wallet page). */
export async function sendCredit(formData: FormData): Promise<void> {
  const raw = String(formData.get("amount") ?? "").replace(",", ".");
  const dollars = Number(raw);
  if (!Number.isFinite(dollars) || dollars <= 0) redirect("/app/wallet?err=send");

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_credit", {
    p_amount_cents: dollarsToCents(dollars),
  });
  if (error) redirect("/app/wallet?err=send");
  redirect("/app/wallet?sent=1");
}

/** Claims credit by code into the signed-in rider's wallet. */
export async function claimCredit(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/app/wallet");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_credit", { p_code: code });
  if (error) redirect("/app/wallet?claim=invalid_code");
  const outcome =
    (data as { outcome: string }[] | null)?.[0]?.outcome ?? "invalid_code";
  redirect(`/app/wallet?claim=${outcome}`);
}

/** Sender takes an unclaimed transfer back; escrow returns to their wallet. */
export async function cancelTransfer(formData: FormData): Promise<void> {
  const id = String(formData.get("transfer") ?? "");
  if (!id) redirect("/app/wallet");

  const supabase = await createClient();
  await supabase.rpc("cancel_transfer", { p_transfer: id });
  redirect("/app/wallet");
}

/**
 * Buys a ride for someone else (batch V6). The recipient needs no account and
 * no wallet, only the board code, so a gift is a single direct leg: a code the
 * sender can hand over in one message. A trip that needs a transfer is refused
 * plainly rather than gifted as half a journey the recipient cannot finish.
 */
export async function giftRide(formData: FormData): Promise<void> {
  const fromStop = String(formData.get("from") ?? "");
  const toStop = String(formData.get("to") ?? "");
  const back = `/app/plan?from=${encodeURIComponent(fromStop)}&to=${encodeURIComponent(toStop)}`;
  if (!fromStop || !toStop || fromStop === toStop) redirect("/app");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?why=pay");

  const network = await fetchNetwork(supabase);
  const plan = planTrip(network, fromStop, toStop);
  if (!plan) redirect(`${back}&err=noroute`);
  const rideLegs = plan.legs.filter((l): l is RideLeg => l.type === "ride");
  if (rideLegs.length !== 1) redirect(`${back}&err=gifttransfer`);

  const leg = rideLegs[0]!;
  const { data, error } = await supabase.rpc("gift_ticket", {
    p_route: leg.routeId,
    p_direction: leg.direction,
    p_from_stop: leg.boardStopId,
    p_to_stop: leg.alightStopId,
  });
  if (error) {
    redirect(`${back}&err=${error.message.includes("insufficient") ? "balance" : "gift"}`);
  }
  const ticketId = (data as { ticket_id: string }[] | null)?.[0]?.ticket_id;
  if (!ticketId) redirect(`${back}&err=gift`);
  redirect(`/app/gift/${ticketId}`);
}

/** Takes a gifted ride back, if nobody has boarded it yet. */
export async function revokeGift(formData: FormData): Promise<void> {
  const ticket = String(formData.get("ticket") ?? "");
  if (!ticket) redirect("/app/wallet");

  const supabase = await createClient();
  const { data } = await supabase.rpc("revoke_gift", { p_ticket: ticket });
  const outcome = (data as { outcome: string }[] | null)?.[0]?.outcome ?? "gift";
  redirect(`/app/gift/${ticket}?done=${outcome}`);
}

/**
 * Books a parcel between two stops. Parcels ride one kombi, so the pair must
 * plan as a single direct leg; anything needing a transfer is refused with a
 * clear message instead of quietly booking half a journey.
 */
export async function bookParcel(formData: FormData): Promise<void> {
  const fromStop = String(formData.get("from") ?? "");
  const toStop = String(formData.get("to") ?? "");
  const payment = String(formData.get("payment") ?? "wallet");
  if (!fromStop || !toStop || fromStop === toStop) {
    redirect("/app/parcel?err=stops");
  }
  if (payment !== "wallet" && payment !== "cash") redirect("/app/parcel");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const network = await fetchNetwork(supabase);
  const plan = planTrip(network, fromStop, toStop);
  const rides = plan?.legs.filter((l): l is RideLeg => l.type === "ride") ?? [];
  if (!plan || plan.legs.length !== 1 || rides.length !== 1) {
    redirect("/app/parcel?err=direct");
  }

  const leg = rides[0]!;
  const { error } = await supabase.rpc("purchase_parcel", {
    p_route: leg.routeId,
    p_direction: leg.direction,
    p_from_stop: leg.boardStopId,
    p_to_stop: leg.alightStopId,
    p_payment: payment,
  });
  if (error) {
    const err = error.message.includes("insufficient") ? "balance" : "book";
    redirect(`/app/parcel?err=${err}`);
  }
  redirect("/app/parcel?booked=1");
}
