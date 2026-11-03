import { useId, useMemo, useState } from "react";
import { Kbd } from "./ui";

// Ctrl/⌘ + K launcher. `commands` are static entries; `dynamic(query)` returns query-specific ones.
// Rendered only while open, so every opening starts with a fresh query.
export default function CommandPalette({ onClose, commands, dynamic }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matches = commands.filter(command => !text || `${command.label} ${command.group} ${command.keywords ?? ""}`.toLowerCase().includes(text));
    return [...(text ? dynamic(query.trim()) : []), ...matches].slice(0, 12);
  }, [commands, dynamic, query]);

  const run = command => { onClose(); command.run(); };
  const onKeyDown = event => {
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor(value => (value + 1) % Math.max(results.length, 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor(value => (value - 1 + results.length) % Math.max(results.length, 1)); }
    else if (event.key === "Enter" && results[cursor]) { event.preventDefault(); run(results[cursor]); }
    else if (event.key === "Escape") { event.preventDefault(); onClose(); }
  };

  let lastGroup = null;
  return <div className="nx-palette-backdrop" onMouseDown={onClose}>
    <div className="nx-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={event => event.stopPropagation()}>
      <div className="nx-palette-input"><span aria-hidden="true">⌕</span><input autoFocus value={query} onChange={event => { setQuery(event.target.value); setCursor(0); }} onKeyDown={onKeyDown} placeholder="Search commands, cities, seismic regions…" role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={results[cursor] ? `${listId}-${cursor}` : undefined} /><Kbd>ESC</Kbd></div>
      <ul className="nx-palette-list" id={listId} role="listbox">
        {results.map((command, index) => {
          const header = command.group !== lastGroup ? command.group : null;
          lastGroup = command.group;
          return <li key={`${command.group}-${command.label}`} role="presentation">
            {header && <p className="nx-palette-group">{header}</p>}
            <button type="button" id={`${listId}-${index}`} role="option" aria-selected={index === cursor} className={index === cursor ? "nx-active" : ""} onMouseEnter={() => setCursor(index)} onClick={() => run(command)}>
              <span className="nx-palette-icon" aria-hidden="true" style={command.color ? { color: command.color } : undefined}>{command.icon}</span>
              <span className="nx-palette-label">{command.label}{command.detail && <small>{command.detail}</small>}</span>
              {command.hint && <Kbd>{command.hint}</Kbd>}
            </button>
          </li>;
        })}
        {!results.length && <li className="nx-palette-empty">No commands match “{query}”.</li>}
      </ul>
      <footer className="nx-palette-footer"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span><span><Kbd>↵</Kbd> run</span><span><Kbd>Ctrl</Kbd><Kbd>K</Kbd> toggle</span></footer>
    </div>
  </div>;
}
