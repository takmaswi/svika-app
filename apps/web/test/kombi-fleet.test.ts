import { describe, expect, test } from "vitest";
import { SIM_VEHICLES } from "../src/lib/map/sim-config";
import {
  joinFleetProfiles,
  SIM_PLATE_BY_ID,
  type KombiBoardRow,
} from "../src/lib/kombi/fleet";

const row = (plate: string, over: Partial<KombiBoardRow> = {}): KombiBoardRow => ({
  plate,
  capacity: 16,
  verified_fares_30d: 0,
  fare_days_30d: 0,
  peak_hour_load_30d: null,
  drift_days_30d: 0,
  last_verified_at: null,
  pulse_fares: 0,
  pulse_window_minutes: 20,
  ...over,
});

describe("the sim fleet to registry bridge", () => {
  test("every simulated vehicle has a plate mapping", () => {
    for (const v of SIM_VEHICLES) {
      expect(SIM_PLATE_BY_ID[v.id], `${v.id} needs a registry plate`).toBeTruthy();
    }
  });

  test("registry rows join by plate and derive their state", () => {
    const rows = [
      row("AEZ 4821", { verified_fares_30d: 40, fare_days_30d: 10 }),
      row("AFK 2903"),
    ];
    const profiles = joinFleetProfiles(["sim-1", "sim-2"], rows);
    expect(profiles[0]).toMatchObject({ simId: "sim-1", plate: "AEZ 4821", trust: "verified" });
    expect(profiles[1]).toMatchObject({ simId: "sim-2", plate: "AFK 2903", trust: "unverified" });
  });

  test("a sim id with no registry row stays unverified with no facts", () => {
    const profiles = joinFleetProfiles(["sim-3"], []);
    expect(profiles[0]).toMatchObject({
      simId: "sim-3",
      plate: "AGT 1157",
      facts: null,
      trust: "unverified",
    });
  });

  test("an unknown sim id still yields the unverified default", () => {
    const profiles = joinFleetProfiles(["sim-99"], []);
    expect(profiles[0]).toMatchObject({ simId: "sim-99", plate: null, trust: "unverified" });
  });

  test("a registry row carries its rank pulse through the join", () => {
    const rows = [row("AEZ 4821", { pulse_fares: 14 })];
    const profiles = joinFleetProfiles(["sim-1"], rows);
    expect(profiles[0]?.pulse).toEqual({
      state: "almost",
      fares: 14,
      capacity: 16,
      windowMinutes: 20,
    });
  });

  test("no registry row means no pulse at all, not a quiet one", () => {
    expect(joinFleetProfiles(["sim-3"], [])[0]?.pulse).toBeNull();
  });
});
