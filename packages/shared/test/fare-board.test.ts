import { describe, expect, test } from "vitest";
import { summariseFareBoard, type FareBucket } from "../src/fare-board";

// The fare board is history, not editorial. These tests hold the arithmetic
// and the one judgement call in it: when the evidence is split, the board
// leans to the lower fare rather than nudging the going rate upwards.

const b = (hour: number, fareCents: number, tickets: number): FareBucket => ({
  hour,
  fareCents,
  tickets,
});

describe("summariseFareBoard", () => {
  test("a day nobody paid for has nothing to say", () => {
    expect(summariseFareBoard([])).toBeNull();
  });

  test("zero ticket and zero fare buckets are not evidence", () => {
    expect(summariseFareBoard([b(7, 150, 0), b(8, 0, 4)])).toBeNull();
  });

  test("one fare all day is the typical fare, and the board says it did not vary", () => {
    const board = summariseFareBoard([b(6, 150, 4), b(7, 150, 9), b(17, 150, 6)])!;
    expect(board.tickets).toBe(19);
    expect(board.typicalCents).toBe(150);
    expect(board.lowCents).toBe(150);
    expect(board.highCents).toBe(150);
    expect(board.varied).toBe(false);
  });

  test("the range is what was actually paid, low and high", () => {
    const board = summariseFareBoard([b(6, 150, 10), b(17, 200, 3), b(18, 100, 1)])!;
    expect(board.lowCents).toBe(100);
    expect(board.highCents).toBe(200);
    expect(board.varied).toBe(true);
    expect(board.typicalCents).toBe(150);
  });

  test("a peak jump shows up as an hour, not as a verdict", () => {
    const board = summariseFareBoard([
      b(9, 150, 6),
      b(17, 150, 2),
      b(17, 200, 11),
      b(18, 200, 4),
    ])!;
    const peak = board.hours.find((h) => h.hour === 17)!;
    expect(peak.tickets).toBe(13);
    expect(peak.typicalCents).toBe(200);
    // the day as a whole still reads as the fare most riders paid
    expect(board.typicalCents).toBe(200);
    expect(board.busiestHour).toBe(17);
  });

  test("a tie leans to the lower fare: the board never talks the price up", () => {
    const board = summariseFareBoard([b(7, 150, 5), b(7, 200, 5)])!;
    expect(board.typicalCents).toBe(150);
    expect(board.hours[0]!.typicalCents).toBe(150);
  });

  test("hours come back in order, and only hours that carried a fare", () => {
    const board = summariseFareBoard([b(18, 150, 1), b(6, 150, 2), b(12, 150, 3)])!;
    expect(board.hours.map((h) => h.hour)).toEqual([6, 12, 18]);
  });

  test("the busiest hour counts every fare in it, not just one bucket", () => {
    const board = summariseFareBoard([
      b(6, 150, 7),
      b(17, 150, 4),
      b(17, 200, 4),
    ])!;
    expect(board.busiestHour).toBe(17);
    expect(board.hours.find((h) => h.hour === 17)!.tickets).toBe(8);
  });

  test("a single ticket is still an honest board", () => {
    const board = summariseFareBoard([b(14, 175, 1)])!;
    expect(board.tickets).toBe(1);
    expect(board.typicalCents).toBe(175);
    expect(board.varied).toBe(false);
    expect(board.busiestHour).toBe(14);
  });
});
