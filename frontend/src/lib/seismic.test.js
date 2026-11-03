import { describe, expect, it } from "vitest";
import { hotspots, magnitudeClass, regionOf, relativeTime, summarize, timeline, toCSV } from "./seismic";

const now = Date.UTC(2026, 10, 2, 12);
const events = [
  { usgs_id: "a", magnitude: 1.2, place: "10 km N of Anza, CA", time: new Date(now - 30 * 60000).toISOString(), depth: 8 },
  { usgs_id: "b", magnitude: 5.6, place: "Fiji region", time: new Date(now - 5 * 3600000).toISOString(), depth: 410, tsunami: true },
  { usgs_id: "c", magnitude: 3.1, place: "5 km SW of Volcano, Hawaii", time: new Date(now - 90 * 60000).toISOString(), depth: 2 },
  { usgs_id: "d", magnitude: null, place: "22 km E of Ridgecrest, CA", time: "invalid", depth: null },
];

describe("seismic analytics", () => {
  it("classifies magnitudes on an ordinal scale", () => {
    expect(magnitudeClass(1.9).id).toBe("micro");
    expect(magnitudeClass(4).id).toBe("moderate");
    expect(magnitudeClass(7.1).id).toBe("strong");
    expect(magnitudeClass(null)).toBeNull();
  });

  it("extracts regions from USGS place names", () => {
    expect(regionOf("10 km N of Anza, CA")).toBe("California");
    expect(regionOf("Fiji region")).toBe("Fiji region");
    expect(regionOf(undefined)).toBe("Unknown region");
  });

  it("summarises the feed while ignoring invalid values", () => {
    const summary = summarize(events);
    expect(summary.count).toBe(4);
    expect(summary.strongest.usgs_id).toBe("b");
    expect(summary.latest.usgs_id).toBe("a");
    expect(summary.average).toBeCloseTo(3.3, 1);
    expect(summary.significant).toBe(1);
    expect(summary.tsunami).toBe(1);
  });

  it("buckets events into a timeline that ends now", () => {
    const buckets = timeline(events, 24, now);
    expect(buckets).toHaveLength(24);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(3);
    expect(buckets[23].count).toBe(1);
    expect(buckets[19].max).toBe(5.6);
  });

  it("ranks regional hotspots", () => {
    expect(hotspots(events)[0]).toMatchObject({ region: "California", count: 2, max: 1.2 });
  });

  it("exports quoted CSV and neutralises formulas", () => {
    const csv = toCSV([{ usgs_id: "x", place: '=HYPERLINK("bad")', magnitude: 2 }]);
    expect(csv.split("\r\n")[0]).toContain("usgs_id,time,magnitude");
    expect(csv).toContain(`"'=HYPERLINK(""bad"")"`);
  });

  it("formats relative times", () => {
    expect(relativeTime(new Date(now - 45000).toISOString(), now)).toBe("45s ago");
    expect(relativeTime(new Date(now - 2 * 3600000).toISOString(), now)).toBe("2h ago");
    expect(relativeTime("nope", now)).toBe("—");
  });
});
