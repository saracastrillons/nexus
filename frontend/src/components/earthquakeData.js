export function numeric(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function timestamp(value) {
  if (value == null || value === "") return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

export function selectEvents(events, search, minimum, order) {
  const query = search.trim().toLowerCase();
  return events.filter(event => String(event.place ?? "").toLowerCase().includes(query) &&
    (minimum === "all" || (numeric(event.magnitude) !== null && numeric(event.magnitude) >= Number(minimum))))
    .sort((a, b) => {
      const left = order === "newest" ? timestamp(a.time) : numeric(a.magnitude);
      const right = order === "newest" ? timestamp(b.time) : numeric(b.magnitude);
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      return order === "lowest" ? left - right : right - left;
    });
}
