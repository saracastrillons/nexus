import { describe, expect, it } from "vitest";
import { selectEvents, numeric } from "./earthquakeData";
import { readWeather, readCity, weatherValue } from "./weatherData";
import { cleanHistory, readReply } from "./chatData";

describe("seismic explorer", () => {
  const events = [
    { place: "Japan", magnitude: "4.4", time: "2026-10-30T12:00:00Z" },
    { place: "California", magnitude: 0, time: "2026-10-30T14:00:00Z" },
    { place: null, magnitude: null, time: "invalid" },
  ];
  it("combines trimmed location and magnitude filters", () => expect(selectEvents(events, " JAPAN ", "4", "newest")).toEqual([events[0]]));
  it("keeps zero magnitude and puts unavailable values last", () => expect(selectEvents(events, "", "all", "lowest")).toEqual([events[1], events[0], events[2]]));
  it("sorts timestamps and leaves the source unchanged", () => {
    expect(selectEvents(events, "", "all", "newest")[0]).toBe(events[1]);
    expect(events[0].place).toBe("Japan");
    expect(numeric("")).toBeNull();
  });
});

describe("weather contracts", () => {
  it("preserves zero measurements and treats invalid data as unavailable", () => {
    const result = readWeather({ data: { current: { precipitation: 0, temperature_2m: "bad" }, timezone: "UTC" } });
    expect(result.weather.precipitation).toBe(0);
    expect(result.weather.temperature_2m).toBeNull();
    expect(weatherValue(null)).toBe("—");
    expect(result.timezone).toBe("UTC");
  });
  it("rejects malformed weather and out-of-range geocoding", () => {
    expect(() => readWeather({ data: { current: [] } })).toThrow();
    expect(() => readCity({ status: "success", data: { name: "Invalid", latitude: 91, longitude: 0 } })).toThrow();
  });
});

describe("chat contracts", () => {
  it("retains compatible saved history without accepting system roles", () => {
    expect(cleanHistory([{ role: "system", content: "bad" }, { role: "user", content: "Hello", extra: true }])).toEqual([{ role: "user", content: "Hello" }]);
  });
  it("rejects empty replies instead of rendering a blank response", () => expect(() => readReply({ ai_response: " " })).toThrow());
});
