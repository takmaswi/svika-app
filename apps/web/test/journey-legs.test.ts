// The leg chain: the shape of a recorded trip. These are the rules the
// field logger got right and the ones it got wrong, pinned side by side.
import { describe, it, expect } from "vitest";
import {
  closeLegs,
  currentLegIndex,
  currentLegMode,
  journeyModeFor,
  openingLeg,
  parseFareCents,
  toRpcLeg,
  // aliased so the tests read like the trip they describe
  transitionLegs as transition,
  type LocalLeg,
} from "../src/lib/journey/legs";

const J = "journey-1";

function ride(legs: LocalLeg[], at: number, route = "Heights to Rezende") {
  return transition(legs, at, "riding", {
    routeName: route,
    direction: "outbound" as const,
    fareCents: 150,
  });
}

describe("openingLeg", () => {
  it("starts every recording walking on leg 0", () => {
    const leg = openingLeg(J, 1000);
    expect(leg.legIndex).toBe(0);
    expect(leg.mode).toBe("walking");
    expect(leg.endedAt).toBeNull();
    expect(leg.routeName).toBeNull();
  });
});

describe("transitionLegs", () => {
  it("closes the open leg and opens the next, bumping the index", () => {
    const legs = transition([openingLeg(J, 0)], 500, "waiting");
    expect(legs).toHaveLength(2);
    expect(legs[0]!.endedAt).toBe(500);
    expect(legs[1]!.legIndex).toBe(1);
    expect(legs[1]!.mode).toBe("waiting");
    expect(legs[1]!.startedAt).toBe(500);
  });

  it("keeps route, direction and fare on a riding leg only", () => {
    const boarded = ride([openingLeg(J, 0)], 100);
    expect(boarded[1]!.routeName).toBe("Heights to Rezende");
    expect(boarded[1]!.direction).toBe("outbound");
    expect(boarded[1]!.fareCents).toBe(150);

    const off = transition(boarded, 200, "walking", {
      routeName: "ignored",
      direction: "inbound",
      fareCents: 999,
    });
    expect(off[2]!.routeName).toBeNull();
    expect(off[2]!.direction).toBeNull();
    expect(off[2]!.fareCents).toBeNull();
  });

  it("supports a transfer trip with any number of kombis", () => {
    let legs = [openingLeg(J, 0)];
    legs = transition(legs, 10, "waiting");
    legs = ride(legs, 20, "Route A");
    legs = transition(legs, 30, "walking");
    legs = ride(legs, 40, "Route B");
    legs = transition(legs, 50, "walking");
    expect(legs.map((l) => l.mode)).toEqual([
      "walking",
      "waiting",
      "riding",
      "walking",
      "riding",
      "walking",
    ]);
    expect(currentLegIndex(legs)).toBe(5);
    expect(currentLegMode(legs)).toBe("walking");
  });

  it("never mutates the legs it was given", () => {
    const before = [openingLeg(J, 0)];
    const snapshot = JSON.stringify(before);
    transition(before, 500, "riding", {
      routeName: "x",
      direction: "inbound",
      fareCents: 1,
    });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("clamps a transition that would open a leg before the one it follows", () => {
    // a phone whose clock steps backwards mid trip must not store a
    // negative duration
    const legs = transition([openingLeg(J, 5_000)], 1_000, "riding", {
      routeName: "Route A",
      direction: "outbound",
      fareCents: null,
    });
    expect(legs[0]!.endedAt).toBe(5_000);
    expect(legs[1]!.startedAt).toBe(5_000);
  });

  it("drops a blank route name rather than storing an empty string", () => {
    const legs = transition([openingLeg(J, 0)], 10, "riding", {
      routeName: "   ",
      direction: "inbound",
      fareCents: null,
    });
    expect(legs[1]!.routeName).toBeNull();
  });
});

describe("closeLegs", () => {
  it("ends the open leg and leaves the rest alone", () => {
    const legs = closeLegs(ride([openingLeg(J, 0)], 100), 900);
    expect(legs[0]!.endedAt).toBe(100);
    expect(legs[1]!.endedAt).toBe(900);
  });

  it("is idempotent: closing twice does not move the end", () => {
    const once = closeLegs([openingLeg(J, 0)], 900);
    const twice = closeLegs(once, 1_500);
    expect(twice[0]!.endedAt).toBe(900);
  });
});

describe("journeyModeFor", () => {
  it("keeps the rider's own pick when they tagged nothing", () => {
    expect(journeyModeFor([openingLeg(J, 0)], "kombi")).toBe("kombi");
    expect(journeyModeFor([], "walk")).toBe("walk");
  });

  it("a tagged trip with no ride is a walk", () => {
    const legs = transition([openingLeg(J, 0)], 10, "waiting");
    expect(journeyModeFor(legs, "kombi")).toBe("walk");
  });

  it("one kombi is a kombi trip", () => {
    expect(journeyModeFor(ride([openingLeg(J, 0)], 10), "walk")).toBe("kombi");
  });

  it("two kombis is a transfer, which is what mixed means", () => {
    let legs = ride([openingLeg(J, 0)], 10, "Route A");
    legs = transition(legs, 20, "walking");
    legs = ride(legs, 30, "Route B");
    expect(journeyModeFor(legs, "walk")).toBe("mixed");
  });
});

describe("toRpcLeg", () => {
  it("sends ISO times and nulls, never undefined", () => {
    const row = toRpcLeg(openingLeg(J, 1_700_000_000_000));
    expect(row.started_at).toBe("2023-11-14T22:13:20.000Z");
    expect(row.ended_at).toBeNull();
    expect(row.route_name).toBeNull();
    expect(row.fare_cents).toBeNull();
  });
});

describe("parseFareCents", () => {
  it("reads the ways a person actually types a fare", () => {
    expect(parseFareCents("1.50")).toBe(150);
    expect(parseFareCents("1,50")).toBe(150);
    expect(parseFareCents("$1.50")).toBe(150);
    expect(parseFareCents(" 2 ")).toBe(200);
    expect(parseFareCents("0")).toBe(0);
  });

  it("says nothing rather than guessing", () => {
    expect(parseFareCents("")).toBeNull();
    expect(parseFareCents("about two")).toBeNull();
    expect(parseFareCents("1.505")).toBeNull();
    expect(parseFareCents("-1")).toBeNull();
    expect(parseFareCents("99999")).toBeNull();
  });
});
