import React, { useState } from "react";
import { api } from "../api.js";

const fmtBytes = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1024) + " KB");

function Copyable({ text }) {
  const [done, setDone] = useState(false);
  return (
    <div className="cmd">
      <code>{text}</code>
      <button
        className="btn small ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          } catch {
            /* clipboard may be blocked */
          }
        }}
      >
        {done ? "copied" : "copy"}
      </button>
    </div>
  );
}

export default function Publish({ cli, onChanged }) {
  const [bump, setBump] = useState("patch");
  const [busy, setBusy] = useState(false);
  const [packResult, setPackResult] = useState(null);
  const [docker, setDocker] = useState(null);

  const doPack = async () => {
    setBusy(true);
    setPackResult(null);
    try {
      setPackResult(await api.pack({ bump }));
      await onChanged();
    } finally {
      setBusy(false);
    }
  };
  const doDocker = async () => {
    setBusy(true);
    setDocker(null);
    try {
      setDocker(await api.docker({}));
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const latest = cli?.artifacts?.[0];

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Download the CLI</h2>
      </div>
      <p className="hint">
        Rebuilding packs the current Spectral rule set — every custom rule you've authored — into a
        versioned tarball. Anyone can install it and immediately get your rules. No separate ruleset
        to wire up.
      </p>

      <div className="panel">
        <div className="panel-row">
          <div>
            <div className="kv">
              <span>Package</span>
              <code>{cli?.name}</code>
            </div>
            <div className="kv">
              <span>Version</span>
              <code>{cli?.version}</code>
            </div>
            <div className="kv">
              <span>Custom rules bundled</span>
              <b>{cli?.customRuleCount}</b>
            </div>
          </div>
          <div className="build-box">
            <label className="field inline">
              <span>Version bump</span>
              <select value={bump} onChange={(e) => setBump(e.target.value)}>
                <option value="patch">patch</option>
                <option value="minor">minor</option>
                <option value="major">major</option>
              </select>
            </label>
            <button className="btn primary" onClick={doPack} disabled={busy}>
              {busy ? "Building…" : "Build new download"}
            </button>
          </div>
        </div>
        {packResult &&
          (packResult.ok ? (
            <div className="alert ok">
              ✓ Built <code>{packResult.file}</code> (v{packResult.version}) with {packResult.customRuleCount}{" "}
              custom rules.
            </div>
          ) : (
            <div className="alert error">✗ {packResult.error}</div>
          ))}
      </div>

      <h3>Install with npm</h3>
      {latest ? (
        <>
          <p className="hint">
            Download the tarball, then install it globally. The <code>{cli.bin}</code> command becomes
            available everywhere (Spectral ships as a dependency).
          </p>
          <div className="downloads">
            {cli.artifacts.map((a) => (
              <div className="dl-row" key={a.file}>
                <a className="btn small" href={`/download/${a.file}`} download>
                  ⤓ {a.file}
                </a>
                <span className="muted">{fmtBytes(a.bytes)}</span>
              </div>
            ))}
          </div>
          <Copyable text={`npm install -g ./${latest.file}`} />
          <p className="hint">Then lint a config or spec:</p>
          <Copyable text={`${cli.bin} path/to/config.yaml --format stylish`} />
          <p className="hint">Custom rules apply automatically. List what's bundled:</p>
          <Copyable text={`${cli.bin} --list`} />
        </>
      ) : (
        <div className="empty sm">No build yet — click “Build new download”.</div>
      )}

      <h3>Run with Docker</h3>
      <p className="hint">Build a self-contained image (no Node needed to run). Good for CI pipelines.</p>
      <button className="btn" onClick={doDocker} disabled={busy}>
        {busy ? "Working…" : "Build Docker image"}
      </button>
      {docker &&
        (docker.ok ? (
          <div className="alert ok">
            ✓ Built image <code>{docker.tag}</code>
            <Copyable text={docker.runCommand} />
          </div>
        ) : (
          <div className="alert error">
            ✗ {docker.error}
            {docker.detail && <pre className="code small">{docker.detail}</pre>}
          </div>
        ))}
    </div>
  );
}
