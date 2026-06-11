import React from "react";
import { api } from "../api.js";

export default function RulesList({ rules, onNew, onEdit, onChanged }) {
  const [busy, setBusy] = React.useState(null);

  const del = async (name) => {
    if (!confirm(`Delete rule ${name}? It will be removed from the CLI bundle.`)) return;
    setBusy(name);
    const res = await api.remove(name);
    setBusy(null);
    if (res && res.error) {
      alert(res.error);
      return;
    }
    onChanged();
  };

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Custom rules</h2>
        <button className="btn primary" onClick={onNew}>
          + New rule
        </button>
      </div>
      <p className="hint">
        These Spectral rules live in <code>cli/rules/custom/</code> and are bundled into every CLI
        download. Author one here, then rebuild the CLI on the <b>Download CLI</b> tab.
      </p>

      {rules.custom.length === 0 ? (
        <div className="empty">No custom rules yet. Create your first one.</div>
      ) : (
        <div className="cards">
          {rules.custom.map((r) => (
            <div className="card" key={r.name}>
              <div className="card-top">
                <span className="ruleid">{r.name}</span>
                <span className={`sev sev-${r.severity}`}>{r.severity}</span>
              </div>
              <div className="card-name">{r.description}</div>
              <div className="card-meta">
                <span className="chip mono">{r.given}</span>
              </div>
              <div className="card-actions">
                <button className="btn small" onClick={() => onEdit(r.name)}>
                  {r.editable ? "Edit" : "View"}
                </button>
                <button className="btn small danger" disabled={busy === r.name} onClick={() => del(r.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-head" style={{ marginTop: 28 }}>
        <h2>Inherited rulesets</h2>
      </div>
      {rules.inherited && rules.inherited.length ? (
        <div className="builtins">
          {rules.inherited.map((e) => (
            <div className="builtin-row" key={e}>
              <span className="ruleid sm">extends</span>
              <span className="builtin-name">{e}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">
          None — this distribution lints generic Istio/Envoy/K8s YAML &amp; OpenAPI using only the
          custom rules above (no <code>spectral:oas</code> base). Add an <code>extends</code> in{" "}
          <code>cli/rules/base.json</code> to inherit a shared ruleset.
        </p>
      )}
    </div>
  );
}
