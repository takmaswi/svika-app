// Which stop is "the rider's stop" for the kombi card and board. One rule,
// shared by both surfaces so they always talk about the same place: the
// rider's newest saved trip when it sits on the corridor, otherwise the
// corridor's first rank. The terminus names give the direction line its
// destination ("Heading to {name}").
import { tripDirection } from "../map/eta-live";

export interface CorridorStopRowLike {
  stop_id: string;
  stops: { name: string } | null;
}

export interface KombiStopContext {
  stopId: string;
  stopName: string;
  direction: "outbound" | "inbound";
  terminus: { outbound: string; inbound: string };
}

export function riderStopContext(
  corridorRows: CorridorStopRowLike[],
  savedTrip: { from_stop_id: string; to_stop_id: string } | null | undefined,
): KombiStopContext | null {
  if (corridorRows.length < 2) return null;
  const orderedIds = corridorRows.map((r) => r.stop_id);
  const nameOf = (id: string) =>
    corridorRows.find((r) => r.stop_id === id)?.stops?.name ?? "";
  const terminus = {
    // outbound runs first stop -> last stop; inbound heads back to the first
    outbound: corridorRows[corridorRows.length - 1]!.stops?.name ?? "",
    inbound: corridorRows[0]!.stops?.name ?? "",
  };

  if (savedTrip) {
    const direction = tripDirection(
      orderedIds,
      savedTrip.from_stop_id,
      savedTrip.to_stop_id,
    );
    if (direction) {
      return {
        stopId: savedTrip.from_stop_id,
        stopName: nameOf(savedTrip.from_stop_id),
        direction,
        terminus,
      };
    }
  }
  return {
    stopId: orderedIds[0]!,
    stopName: nameOf(orderedIds[0]!),
    direction: "outbound",
    terminus,
  };
}
