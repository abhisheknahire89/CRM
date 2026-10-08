// Renders docs/ENGINEERING_APPROACH.md into one standalone, print-ready HTML file.
// The markdown stays the single source: the HTML is generated from it, never edited by hand.
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

// usage: node scripts/build-engineering-html.mjs [input.md] [output.html] [concise|detailed]
const [inFile = "docs/ENGINEERING_APPROACH.md", outFile = "engineering-approach.html", mode = "detailed"] = process.argv.slice(2);
const concise = mode === "concise";
const md = readFileSync(inFile, "utf8");
const svg = readFileSync("docs/assets/architecture.svg", "utf8").replace(/width="100%"/, 'width="100%" style="max-width:860px;display:block;margin:0 auto"');

marked.setOptions({ gfm: true });
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const id = slug(text);
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};
let body = marked.parse(md, { renderer });

// inline the diagram
body = body.replace(/<p><img src="assets\/architecture\.svg"[^>]*><\/p>/, `<figure class="diagram">${svg}<figcaption>Production architecture. Layers 4, 6 and 9 are where AI interprets, policy computes and people decide.</figcaption></figure>`);

// pull the title block (h1 + the two lines after it) into a masthead; build a contents list from h2s
const h1 = body.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] ?? "Engineering Approach";
const sections = [...body.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => ({ id: m[1], title: m[2] }));
body = body.replace(/<h1[^>]*>.*?<\/h1>\s*/s, "");
body = body.replace(/^\s*<p><strong>Evidence-native CRM[\s\S]*?<\/p>\s*/, ""); // masthead already carries this
const toc = sections.map((s) => `<li><a href="#${s.id}">${s.title}</a></li>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Engineering Approach${concise ? "" : " (detailed appendix)"} · Deal Evidence Ledger</title>
<style>
:root{--canvas:#f7f8fa;--ink:#14213d;--slate:#334155;--muted:#64748b;--line:#d5dae2;--line-soft:#e6e9ef;--accent:#1d4ed8;--accent-soft:#eef3fd;--sup:#2e7d4f;--uns:#8f5500;--con:#b3261e}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.6 Arial,"Helvetica Neue",Helvetica,sans-serif}
.page{max-width:980px;margin:0 auto;padding:40px 28px 80px}
.masthead{background:#fff;border:1px solid var(--line);border-radius:14px;padding:32px 36px;margin-bottom:28px}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
.masthead h1{font-size:34px;line-height:1.15;margin:0 0 6px;letter-spacing:-.01em}
.masthead .sub{color:var(--slate);margin:0}
.principle{margin-top:18px;font-weight:700;letter-spacing:.02em}
nav.toc{margin-top:22px;border-top:1px solid var(--line-soft);padding-top:16px}
nav.toc ol{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px 24px;counter-reset:s}
nav.toc li{font-size:14px}
nav.toc a{color:var(--accent);text-decoration:none}
nav.toc a:hover{text-decoration:underline}
main h2{font-size:26px;margin:56px 0 14px;padding-top:8px;letter-spacing:-.005em;scroll-margin-top:16px}
main h3{font-size:18px;margin:30px 0 8px}
main p{margin:0 0 14px}
main ul,main ol{padding-left:22px;margin:0 0 14px}
main li{margin:4px 0}
main hr{border:0;border-top:1px solid var(--line);margin:40px 0 0}
a{color:var(--accent)}
blockquote{margin:18px 0;padding:14px 18px;background:var(--accent-soft);border:1px solid #c9d8f7;border-radius:10px;color:var(--slate)}
blockquote p:last-child{margin-bottom:0}
table{width:100%;border-collapse:collapse;margin:14px 0 22px;font-size:14px;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;vertical-align:top;padding:9px 12px;border-bottom:1px solid var(--line-soft)}
th{background:var(--canvas);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
tr:last-child td{border-bottom:0}
td:first-child{font-weight:600}
code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:#eef0f4;padding:1px 5px;border-radius:4px}
pre{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow:auto;font-size:12.5px;line-height:1.5}
pre code{background:none;padding:0}
figure.diagram{margin:20px 0 26px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
figure.diagram figcaption{font-size:13px;color:var(--muted);text-align:center;margin-top:8px}
footer{margin-top:60px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
@media (max-width:640px){.page{padding:20px 14px 60px}.masthead{padding:22px 18px}.masthead h1{font-size:26px}table{display:block;overflow-x:auto}}
@media print{
  @page{size:A4;margin:14mm}
  body{background:#fff;font-size:${concise ? "10px" : "10.5px"};line-height:1.45}
  .page{max-width:none;padding:0}
  .masthead{border:0;padding:0;margin-bottom:10px}
  nav.toc{display:none}
  main h2{margin:22px 0 8px;font-size:19px;break-after:avoid}
  main h3{break-after:avoid;margin:16px 0 6px;font-size:14px}
  ${concise ? "main h2{break-before:page;margin-top:0}main h2:first-of-type{break-before:auto;margin-top:14px}main hr{display:none}" : "main h2#system-architecture,main h2#team{break-before:page;margin-top:0}"}
  tr,pre,figure,blockquote{break-inside:avoid}
  table{font-size:9.5px;margin:8px 0 12px}
  th,td{padding:4px 7px}
  pre{font-size:8.5px;padding:6px 9px;margin:6px 0;white-space:pre-wrap;overflow:visible;word-break:break-word}
  figure.diagram{padding:6px}
  figure.diagram svg{max-height:${concise ? "205mm" : "225mm"};width:auto!important}
  a{color:inherit;text-decoration:none}
}
</style>
</head>
<body>
<div class="page">
  <header class="masthead">
    <p class="eyebrow">Reimagine CRM for the future of sales · deliverable 3 of 3${concise ? " · evaluator edition (6 pages)" : " · detailed appendix"}</p>
    <h1>${h1}</h1>
    <p class="sub">Evidence-native CRM · first product · MVP architecture, team and implementation plan</p>
    <p class="sub">Abhishek Nahire · Product Manager, AI Solutions · written for engineering leadership</p>
    <p class="principle">AI interprets. Policy computes. People decide.</p>
    <nav class="toc" aria-label="Contents"><ol>${toc}</ol></nav>
  </header>
  <main>
${body}
  </main>
  <footer>Castellan Freight, every account, person and quote is illustrative. Thresholds and policy values are proposals to agree with engineering and a design partner, not industry benchmarks. Generated from ${inFile}.</footer>
</div>
</body>
</html>`;
writeFileSync(outFile, html);
console.log("wrote " + outFile, (html.length / 1024).toFixed(0) + " KB");
