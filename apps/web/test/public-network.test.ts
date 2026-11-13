// Ruling 3: a rider never plans on, or is offered, a synthetic test route.
import { expect, test } from "vitest";
import type { Network } from "@svika/shared";
import { planTrip } from "@svika/shared";
import { publicNetwork } from "../src/lib/public-network";

const net: Network = {
  stops: [
    { id: "a", name: "Rezende Rank", lat: -17.83, lng: 31.046 },
    { id: "b", name: "Nssa", lat: -17.82, lng: 31.05 },
    { id: "s1", name: "Synthetic Stop 1", lat: -17.83, lng: 31.05 },
    { id: "s2", name: "Synthetic Stop 2", lat: -17.86, lng: 31.01 },
  ],
  routes: [
    {
      id: "r",
      code: "HEIGHTS-REZENDE",
      name: "real",
      stops: ["a", "b"],
      typicalDurationMinutes: 10,
      defaultFareCents: 100,
      fareSegments: [],
    },
    {
      id: "t",
      code: "TEST-01",
      name: "Synthetic Test Route (not a real corridor)",
      stops: ["s2", "s1", "a"],
      typicalDurationMinutes: 5,
      defaultFareCents: 50,
      fareSegments: [],
    },
  ],
  transfers: [{ fromStopId: "s1", toStopId: "a", walkMinutes: 2, walkMeters: 150 }],
};

test("test routes and the stops only they serve are gone; shared stops stay", () => {
  const pub = publicNetwork(net);
  expect(pub.routes.map((r) => r.code)).toEqual(["HEIGHTS-REZENDE"]);
  expect(pub.stops.map((s) => s.name)).toEqual(["Rezende Rank", "Nssa"]);
  expect(pub.transfers).toEqual([]);
  expect(planTrip(pub, "a", "b")).not.toBeNull();
  expect(planTrip(net, "s2", "a")).not.toBeNull();
  expect(planTrip(pub, "s2", "a")).toBeNull();
});
