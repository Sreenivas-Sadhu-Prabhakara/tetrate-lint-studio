import React, { useMemo, useState } from "react";
import { api } from "../api.js";

const GIVEN_EXAMPLES = ["$.info", "$.spec.http[*]", "$.metadata.labels", "$.paths[*]~", "$..hosts[*]"];

function defaultsFor(tmpl) {
  const p = {};
  (tmpl?.params || []).forEach((f) => (p[f.name] = ""));
  return p;
}

export default function RuleEditor({ meta, editing, onSaved, onCancel }) {
  const templates = meta.templates || [];
  const severities = meta.severities || ["error", "warn", "info", "hint", "off"];
  const readOnly = editing && editing.editable === false;

  const initialTemplate = (editing && editing.templateId) || (templates[0] && templates[0].id) || "";
  const [templateId, setTemplateId] = useState(initialTemplate);
  const tmpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [message, setMessage] = useState(editing?.message || "");
  const [given, setGiven] = useState(editing?.given || "");
  const [severity, setSeverity] = useState(editing?.severity || "warn");
  const [params, setParams] = useState(editing?.params || defaultsFor(tmpl));

  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const onTemplateChange = (id) => {
    setTemplateId(id);
    setParams(defaultsFor(templates.find((t) => t.id === id)));
    setValidation(null);
  };
  const setParam = (k, v) => setParams((p) => ({ ...p, [k]: v }));

  const buildForm = () => ({
    name,
    description,
    message: message || undefined,
    given,
    severity,
    templateId,
    params,
    originalName: editing ? editing.name : undefined,
  });

  const doValidate = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      setValidation(await api.validate(buildForm()));
    } finally {
      setBusy(false);
    }
  };
  const doSave = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      const { status, body } = await api.save(buildForm());
      if (status >= 200 && status < 300) onSaved();
      else {
        setSaveError(body.error || "Save failed");
        if (body.validation) setValidation(body.validation);
      }
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    return (
      <div className="stack">
        <div className="section-head">
          <h2>{editing.name} — view only</h2>
          <button className="btn ghost" onClick={onCancel}>
            ← Back
          </button>
        </div>
        <p className="hint">This rule has no studio template metadata, so it can't be edited in the form.</p>
        <pre className="code">{JSON.stringify(editing, null, 2)}</pre>
      </div>
    );
  }

  const canSubmit = name && given;

  return (
    <div className="editor">
      <div className="editor-form">
        <div className="section-head">
          <h2>{editing ? `Edit ${editing.name}` : "New rule"}</h2>
          <button className="btn ghost" onClick={onCancel}>
            ← Back
          </button>
        </div>

        <label className="field">
          <span>Rule name (kebab-case)</span>
          <input value={name} placeholder="require-info-contact" onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          <span>Description</span>
          <input value={description} placeholder="OpenAPI must declare info.contact" onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="field">
          <span>
            given <em className="req">*</em> — JSONPath the rule applies to
          </span>
          <input className="mono" value={given} placeholder="$.info" onChange={(e) => setGiven(e.target.value)} />
          <small className="desc">
            examples:{" "}
            {GIVEN_EXAMPLES.map((g) => (
              <button key={g} type="button" className="chip mono linkish" onClick={() => setGiven(g)}>
                {g}
              </button>
            ))}
          </small>
        </label>

        <div className="row">
          <label className="field">
            <span>Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {severities.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Template (the `then` clause)</span>
            <select value={templateId} onChange={(e) => onTemplateChange(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tmpl && <small className="desc">{tmpl.description}</small>}

        {(tmpl?.params || []).map((f) => (
          <label className="field" key={f.name}>
            <span>
              {f.label} {f.required ? <em className="req">*</em> : null}
            </span>
            {f.type === "code" ? (
              <textarea rows={6} className="mono" value={params[f.name] || ""} placeholder={f.placeholder} onChange={(e) => setParam(f.name, e.target.value)} />
            ) : f.type === "enum" ? (
              <select value={params[f.name] || ""} onChange={(e) => setParam(f.name, e.target.value)}>
                <option value="">— choose —</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input type={f.type === "number" ? "number" : "text"} value={params[f.name] || ""} placeholder={f.placeholder} onChange={(e) => setParam(f.name, e.target.value)} />
            )}
          </label>
        ))}

        <label className="field">
          <span>Message (optional — defaults to description)</span>
          <input value={message} placeholder="{{description}} (at {{path}})" onChange={(e) => setMessage(e.target.value)} />
        </label>

        <div className="actions">
          <button className="btn" onClick={doValidate} disabled={busy || !canSubmit}>
            {busy ? "Running…" : "Validate"}
          </button>
          <button className="btn primary" onClick={doSave} disabled={busy || !canSubmit}>
            {editing ? "Save changes" : "Create rule"}
          </button>
        </div>
        {saveError && <div className="alert error">{saveError}</div>}
      </div>

      <div className="editor-preview">
        <h3>Validation</h3>
        {!validation ? (
          <div className="empty sm">
            Click <b>Validate</b> to run this rule against the sample Istio / Gateway / OpenAPI files.
          </div>
        ) : validation.ok ? (
          <div className={`alert ${validation.firedCount ? "ok" : "warn"}`}>
            ✓ Rule loaded and ran cleanly.{" "}
            {validation.firedCount
              ? `Fired ${validation.firedCount} time(s) on the sample configs.`
              : "It did not fire on the samples (that may be expected)."}
          </div>
        ) : (
          <div className="alert error">
            ✗ {validation.error}
            {validation.detail && <pre className="code small">{validation.detail}</pre>}
          </div>
        )}

        {validation?.findings?.length > 0 && (
          <ul className="findings">
            {validation.findings.map((f, i) => (
              <li key={i}>
                <code>{f.source}</code>
                {f.line ? `:${f.line}` : ""} — {f.message}
              </li>
            ))}
          </ul>
        )}

        {validation?.code && (
          <>
            <h3>Generated Spectral rule</h3>
            <pre className="code">{validation.code}</pre>
          </>
        )}
      </div>
    </div>
  );
}
