import { useId, useRef, useState } from "react";
import { downloadCSV, magnitudeColor } from "../lib/seismic";
import { numeric, timestamp, selectEvents } from "./earthquakeData";

const PAGE_SIZE = 10;
function Magnitude({ value }) {
  const number = numeric(value);
  const level =
    number === null
      ? "unknown"
      : number >= 6
        ? "high"
        : number >= 4
          ? "medium"
          : number >= 2
            ? "moderate"
            : "low";
  return (
    <span className={`nx-seismic-badge nx-seismic-${level}`} style={{ "--mag": magnitudeColor(number) }}>
      <i aria-hidden="true" />
      {number === null ? "Unavailable" : `M ${number.toFixed(2)}`}
    </span>
  );
}

export default function EarthquakeTable({ events = [], loading = false, error = null, updated = null, onRefresh, onLocate, search: requestedSearch = "", windowTitle = "" }) {
  const [search, setSearch] = useState(requestedSearch);
  const [minimum, setMinimum] = useState("all");
  const [order, setOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const id = useId();
  const resultsRef = useRef(null);

  const filtered = selectEvents(events, search, minimum, order);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const magnitudes = filtered
    .map((event) => numeric(event.magnitude))
    .filter((value) => value !== null);
  const maximum = magnitudes.length
    ? magnitudes.reduce((a, b) => Math.max(a, b))
    : null;
  const activeFilters =
    search.trim() !== "" || minimum !== "all" || order !== "newest";
  const reset = () => {
    setSearch("");
    setMinimum("all");
    setOrder("newest");
    setPage(1);
  };
  const exportCSV = () => downloadCSV(filtered);
  const changePage = (next) => {
    setPage(next);
    resultsRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="nx-seismic">
      <header className="nx-seismic-header">
        <div>
          <p className="nx-eyebrow">SEISMIC EVENT EXPLORER</p>
          <h3>Signals from a moving planet.</h3>
          <p>{windowTitle ? `Live USGS feed · ${windowTitle}.` : "Explore the events available from your monitoring service."}</p>
        </div>
        <div className="nx-seismic-actions">
          <button className="nx-button" type="button" disabled={!filtered.length} onClick={exportCSV}>⤓ Export CSV</button>
          <button className="nx-button nx-primary" type="button" disabled={loading} onClick={onRefresh}>{loading ? "Syncing events…" : "↻ Refresh events"}</button>
        </div>
      </header>
      <div className="nx-seismic-summary">
        <div>
          <span>EVENTS IN RESPONSE</span>
          <strong>{updated ? events.length.toLocaleString() : "—"}</strong>
        </div>
        <div>
          <span>MATCHING EVENTS</span>
          <strong>{updated ? filtered.length.toLocaleString() : "—"}</strong>
        </div>
        <div>
          <span>HIGHEST MATCHING MAGNITUDE</span>
          <strong>{maximum === null ? "—" : maximum.toFixed(2)}</strong>
        </div>
      </div>
      <div className="nx-seismic-filters">
        <label htmlFor={`${id}-search`}>
          Location
          <input
            id={`${id}-search`}
            type="search"
            value={search}
            placeholder="Search a place or region…"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label htmlFor={`${id}-magnitude`}>
          Minimum magnitude
          <select
            id={`${id}-magnitude`}
            value={minimum}
            onChange={(event) => {
              setMinimum(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All magnitudes</option>
            <option value="2">M 2.0 and above</option>
            <option value="4">M 4.0 and above</option>
            <option value="6">M 6.0 and above</option>
          </select>
        </label>
        <label htmlFor={`${id}-sort`}>
          Sort events
          <select
            id={`${id}-sort`}
            value={order}
            onChange={(event) => {
              setOrder(event.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="highest">Highest magnitude</option>
            <option value="lowest">Lowest magnitude</option>
          </select>
        </label>
        <button
          className="nx-button"
          type="button"
          onClick={reset}
          disabled={!activeFilters}
        >
          Reset filters
        </button>
      </div>
      <div className="nx-seismic-meta">
        <span role="status">
          {loading
            ? updated
              ? "Refreshing · previous response remains visible"
              : "Connecting to seismic service…"
            : `${filtered.length} matching ${filtered.length === 1 ? "event" : "events"}`}
        </span>
        <span>
          Last received ·{" "}
          {updated
            ? `${updated.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false })} UTC`
            : "Awaiting response"}
        </span>
      </div>
      {error && (
        <div className="nx-notice" role="alert">
          {error}{" "}
          {updated
            ? "Showing the last successful response."
            : "No event data has been received."}{" "}
          <button
            type="button"
            className="nx-button"
            disabled={loading}
            onClick={onRefresh}
          >
            Retry
          </button>
        </div>
      )}
      <div
        className="nx-seismic-results"
        ref={resultsRef}
        tabIndex={0}
        role="region"
        aria-label="Seismic event results"
        aria-busy={loading}
      >
        <table className="nx-seismic-table">
          <caption className="nx-sr-only">
            Earthquake locations, magnitudes, depths and occurrence times in
            UTC. All counts refer to the backend response.
          </caption>
          <thead>
            <tr>
              <th scope="col">EVENT LOCATION</th>
              <th scope="col">MAGNITUDE</th>
              <th scope="col">DEPTH</th>
              <th scope="col">OCCURRED · UTC</th>
              <th scope="col"><span className="nx-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((event, index) => {
              const occurred = timestamp(event.time);
              const date = occurred === null ? null : new Date(occurred);
              const depth = numeric(event.depth);
              return (
                <tr
                  key={
                    event.usgs_id ??
                    event.id ??
                    `${start + index}-${event.time}-${event.place}`
                  }
                >
                  <td data-label="LOCATION">
                    <span className="nx-seismic-location">
                      {event.place || "Unknown location"}
                    </span>
                    <span className="nx-seismic-id">
                      {event.usgs_id ?? event.id ?? "Event ID unavailable"}
                    </span>
                  </td>
                  <td data-label="MAGNITUDE">
                    <Magnitude value={event.magnitude} />
                  </td>
                  <td data-label="DEPTH">
                    <span className="nx-seismic-depth">
                      {depth === null ? (
                        "Unavailable"
                      ) : (
                        <>
                          {depth.toFixed(1)} <small>km</small>
                        </>
                      )}
                    </span>
                  </td>
                  <td data-label="OCCURRED · UTC">
                    {date ? (
                      <time dateTime={date.toISOString()}>
                        <span>
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                        <small>
                          {date.toLocaleTimeString("en-GB", {
                            timeZone: "UTC",
                            hour12: false,
                          })}{" "}
                          UTC
                        </small>
                      </time>
                    ) : (
                      "Time unavailable"
                    )}
                  </td>
                  <td data-label="ACTIONS" className="nx-seismic-row-actions">
                    {onLocate && <button type="button" className="nx-icon-button" onClick={() => onLocate(event)} aria-label={`Locate ${event.place ?? "event"} on the globe`} title="Locate on globe">◎</button>}
                    {event.url && <a className="nx-icon-button" href={event.url} target="_blank" rel="noopener noreferrer" aria-label={`Open USGS page for ${event.place ?? "event"}`} title="USGS event page">↗</a>}
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={5}>
                  <div className="nx-seismic-empty">
                    <span aria-hidden="true">◎</span>
                    <strong>
                      {loading
                        ? "Receiving seismic events…"
                        : error && !updated
                          ? "Connection unavailable"
                          : events.length
                            ? "No matching events"
                            : "No events available"}
                    </strong>
                    <p>
                      {loading
                        ? "Data will appear when the service responds."
                        : events.length
                          ? "Try another location or lower the magnitude filter."
                          : "No sample events are displayed. Refresh to request data from the service."}
                    </p>
                    {activeFilters && (
                      <button
                        className="nx-button"
                        type="button"
                        onClick={reset}
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="nx-seismic-footer">
        <span>
          {filtered.length
            ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} matching events`
            : "0 events"}
        </span>
        <nav aria-label="Event result pages">
          <button
            className="nx-button"
            type="button"
            disabled={currentPage <= 1}
            onClick={() => changePage(currentPage - 1)}
          >
            ← Previous
          </button>
          <span>
            {currentPage} / {pages}
          </span>
          <button
            className="nx-button"
            type="button"
            disabled={currentPage >= pages}
            onClick={() => changePage(currentPage + 1)}
          >
            Next →
          </button>
        </nav>
      </footer>
      <p className="nx-seismic-note">
        Source: USGS FDSN event service via the NEXUS API · Counts describe the selected live window. Event times are displayed in UTC.
      </p>
    </div>
  );
}
