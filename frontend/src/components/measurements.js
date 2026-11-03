export function formatMeasurement(value, digits = 2) {
  if (value == null || String(value).trim() === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

