import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJSON } from "../services/api";
import { WINDOWS, eventId } from "../lib/seismic";

// One shared live feed for the globe, ticker, analytics and observatory.
export default function useEarthquakes(window = "day", { interval = 60000, onNewEvents } = {}) {
  const [state, setState] = useState({ events: [], busy: true, error: null, updated: null });
  const [revision, setRevision] = useState(0);
  const known = useRef(null);
  const notify = useRef(onNewEvents);
  useEffect(() => { notify.current = onNewEvents; }, [onNewEvents]);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    known.current = null;
    async function load() {
      if (running) return;
      running = true;
      setState(previous => ({ ...previous, busy: true }));
      try {
        const result = await fetchJSON(`/api/earthquakes/?${WINDOWS[window].query}`, { signal: controller.signal, timeout: 20000 });
        if (!Array.isArray(result.data) || result.data.some(event => !event || typeof event !== "object")) throw new Error("The seismic service returned an invalid response.");
        if (controller.signal.aborted) return;
        const ids = new Set(result.data.map(eventId));
        if (known.current) {
          const fresh = result.data.filter(event => !known.current.has(eventId(event)));
          if (fresh.length) notify.current?.(fresh);
        }
        known.current = ids;
        setState({ events: result.data, busy: false, error: null, updated: new Date() });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, busy: false, error: error.name === "TimeoutError" ? "The seismic service timed out." : error.message }));
      } finally { running = false; }
    }
    load();
    const timer = setInterval(load, interval);
    return () => { controller.abort(); clearInterval(timer); };
  }, [window, interval, revision]);

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { ...state, refresh };
}
