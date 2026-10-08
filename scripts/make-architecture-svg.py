#!/usr/bin/env python3
"""Generates docs/assets/architecture.svg: the production architecture from the Engineering Approach."""
import html

W = 1060
LABEL_X, CONTENT_X, CONTENT_R = 28, 272, 1030
BAND_H = 84
GAP = 28
TOP = 64

INK, SLATE, MUTED, LINE, ACCENT, ACCENT_SOFT, CANVAS = "#14213d", "#334155", "#64748b", "#d5dae2", "#1d4ed8", "#eef3fd", "#f7f8fa"

bands = [
    dict(n="1", name="DATA SOURCES", sub="read-only access", kind="plain",
         chips=["Salesforce / HubSpot (one)", "Gmail / Outlook", "Calendar", "Call recorder (one)"]),
    dict(n="2", name="CONNECTORS", sub="ingestion; least-privilege OAuth", kind="plain",
         chips=["OAuth + read-only scopes", "Incremental sync (cursors)", "Webhooks where supported", "Job queue + retries"]),
    dict(n="3", name="NORMALISATION", sub="one shape for every source", kind="plain",
         chips=["Messages", "Calls", "Events", "People", "Accounts", "Deals", "Source metadata + permissions"]),
    dict(n="4", name="EVIDENCE EXTRACTION", sub="structured output, not prose", tag=("AI INTERPRETS", "#1d4ed8"), kind="ai",
         chips=["Claim candidate", "Exact quote / span", "Speaker", "Speaker-role candidate", "Timestamp", "Source link", "Extraction confidence", "Candidate contradiction"]),
    dict(n="5", name="EVIDENCE STORE", sub="Postgres + object store", kind="plain",
         chips=["Raw source reference", "Normalised evidence", "Append-only history", "Verbatim-quote check passed"]),
    dict(n="6", name="POLICY ENGINE", sub="deterministic; same code as the prototype", tag=("POLICY COMPUTES", "#14213d"), kind="policy",
         chips=["Claim definitions", "Authority rules", "Freshness", "Precedence", "Status: Supported · Unsupported · Contradicted · Stale · Unknown"]),
    dict(n="7", name="APPLICATION API", sub="every request checked", kind="plain",
         chips=["SSO + tenant scope", "RBAC", "Source-permission check", "EvidenceRepository contract"]),
    dict(n="8", name="LEDGER UI", sub="Deal Evidence Ledger web app", kind="plain",
         chips=["Evidence queue", "Deal ledger", "Evidence detail + source viewer", "Rep-first view", "RevOps policy"]),
    dict(n="9", name="DECISIONS + AUDIT LOG", sub="human; stored apart from status", tag=("PEOPLE DECIDE", "#334155"), kind="people",
         chips=["Manager decision + reason", "Rep dispute / verify / attach", "Audit trail of every automated judgment"]),
]
arrows = [
    "OAuth · read-only",
    "raw payloads",
    "candidate passages · Commit / Best Case deals only",
    "evidence + extraction confidence · quote verified verbatim",
    "evidence + history",
    "computed status + reason",
    "ledger views",
    "decisions + disputes · never an input to layer 6",
]

def tw(s, size=12.5):
    return len(s) * size * 0.55 + 22

out = []
height = TOP + len(bands) * BAND_H + (len(bands) - 1) * GAP + 44
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {height}" width="100%" role="img" aria-labelledby="t d" font-family="Arial, Helvetica, sans-serif">')
out.append('<title id="t">Production architecture of the Deal Evidence Ledger</title>')
out.append('<desc id="d">Nine layers from read-only data sources through connectors, normalisation, AI evidence extraction, evidence store, deterministic policy engine, application API, ledger UI, to human decisions and the audit log. AI interprets, policy computes, people decide.</desc>')
out.append('<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="%s"/></marker></defs>' % MUTED)
out.append(f'<rect width="{W}" height="{height}" fill="#ffffff"/>')
out.append(f'<text x="{LABEL_X}" y="34" font-size="13" font-weight="700" fill="{INK}">PRODUCTION ARCHITECTURE · V1 · READ-ONLY WITH RESPECT TO THE EXTERNAL CRM</text>')

for i, b in enumerate(bands):
    y = TOP + i * (BAND_H + GAP)
    kind = b["kind"]
    stroke = {"plain": LINE, "ai": ACCENT, "policy": INK, "people": SLATE}[kind]
    fill = {"plain": "#ffffff", "ai": ACCENT_SOFT, "policy": "#ffffff", "people": CANVAS}[kind]
    sw = 2 if kind in ("ai", "policy") else 1.2
    dash = ' stroke-dasharray="6 4"' if kind == "people" else ""
    out.append(f'<rect x="16" y="{y}" width="{CONTENT_R + 14 - 16}" height="{BAND_H}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/>')
    out.append(f'<circle cx="{LABEL_X + 8}" cy="{y + 26}" r="11" fill="{INK}"/><text x="{LABEL_X + 8}" y="{y + 30.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">{b["n"]}</text>')
    out.append(f'<text x="{LABEL_X + 26}" y="{y + 30}" font-size="12.5" font-weight="700" fill="{INK}">{html.escape(b["name"])}</text>')
    out.append(f'<text x="{LABEL_X + 26}" y="{y + 48}" font-size="11" fill="{MUTED}">{html.escape(b["sub"])}</text>')
    if "tag" in b:
        label, color = b["tag"]
        pw = len(label) * 7.1 + 18
        out.append(f'<rect x="{LABEL_X + 26}" y="{y + 56}" width="{pw:.0f}" height="19" rx="9.5" fill="{color}"/>')
        out.append(f'<text x="{LABEL_X + 26 + pw / 2:.0f}" y="{y + 69}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">{label}</text>')
    # chips with wrapping
    cx, cy = CONTENT_X, y + 12
    for c in b["chips"]:
        w = tw(c)
        if cx + w > CONTENT_R:
            cx, cy = CONTENT_X, cy + 28
        chip_stroke = ACCENT if kind == "ai" else (INK if kind == "policy" else LINE)
        out.append(f'<rect x="{cx}" y="{cy}" width="{w:.0f}" height="23" rx="6" fill="#fff" stroke="{chip_stroke}" stroke-opacity="0.55" stroke-width="1"/>')
        out.append(f'<text x="{cx + 11}" y="{cy + 15.5}" font-size="12" fill="{SLATE}">{html.escape(c)}</text>')
        cx += w + 8
    if i < len(bands) - 1:
        ay = y + BAND_H
        out.append(f'<line x1="{CONTENT_X + 120}" y1="{ay + 3}" x2="{CONTENT_X + 120}" y2="{ay + GAP - 4}" stroke="{MUTED}" stroke-width="1.6" marker-end="url(#ah)"/>')
        out.append(f'<text x="{CONTENT_X + 134}" y="{ay + GAP / 2 + 4}" font-size="11" fill="{MUTED}">{html.escape(arrows[i])}</text>')

# "no write-back" marker beside the API / sources
y1 = TOP + 6 * (BAND_H + GAP)
out.append(f'<text x="{CONTENT_X + 480}" y="{TOP + BAND_H + 5}" font-size="0" fill="none"></text>')
out.append(f'<text x="{LABEL_X}" y="{height - 16}" font-size="12" font-weight="700" fill="{INK}">No write-back to the CRM. No customer contact. A human decision never enters layer 6.</text>')
out.append('</svg>')
open('docs/assets/architecture.svg', 'w').write('\n'.join(out))
print(height)
