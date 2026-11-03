import { magnitudeColor } from "../lib/seismic";

// Archive classes from the backend, with a representative magnitude for the shared colour scale.
const CLASSES = [
  ["minor", "Minor", "M < 4", 1.5],
  ["light", "Light", "M 4 – 4.9", 4.5],
  ["moderate", "Moderate", "M 5 – 5.9", 5.5],
  ["strong", "Strong", "M 6 – 6.9", 6.5],
  ["major", "Major", "M 7 – 7.9", 7.5],
  ["great", "Great", "M 8+", 8.5],
];

// The archive is heavily skewed toward small events, so each class is a direct-labelled bar
// whose length is relative to the largest class; counts stay readable for tiny classes.
export default function MagnitudeChart({ data }) {
  const total = CLASSES.reduce((sum, [key]) => sum + (Number(data?.[key]) || 0), 0);
  const top = Math.max(1, ...CLASSES.map(([key]) => Number(data?.[key]) || 0));
  return <table className="nx-distribution">
    <caption className="nx-sr-only">Stored earthquakes by magnitude class</caption>
    <thead className="nx-sr-only"><tr><th scope="col">Class</th><th scope="col">Share</th><th scope="col">Events</th></tr></thead>
    <tbody>{CLASSES.map(([key, label, range, representative]) => {
      const count = Number(data?.[key]) || 0;
      return <tr key={key}>
        <th scope="row">{label}<small>{range}</small></th>
        <td><span className="nx-distribution-bar"><i style={{ width: `${count ? Math.max(1.5, (count / top) * 100) : 0}%`, background: magnitudeColor(representative) }} /></span></td>
        <td><b>{count.toLocaleString()}</b><small>{total ? `${((count / total) * 100).toFixed(1)}%` : "—"}</small></td>
      </tr>;
    })}</tbody>
  </table>;
}
