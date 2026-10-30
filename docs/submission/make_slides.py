import json, base64, html
cfg = json.load(open('/tmp/claude-0/sub/cfg.json')); E = html.escape
S = '/tmp/claude-0/e2e/shots/'
def img(p, h=300):
    return f'<img src="data:image/png;base64,{base64.b64encode(open(p,"rb").read()).decode()}" style="height:{h}px;border:1px solid #ccc;border-radius:6px">'
owners = ''.join(f'<li><b>{E(n)}</b> &#8212; {E(o)}</li>' for n, o in cfg['owners'])
slides = []
def slide(title, body, num):
    slides.append(f'<section><div class="num">{num}</div><h1>{title}</h1>{body}</section>')
slide("Team KARA &#8212; FilsPay: The Handover", f'''<p class="big">We audited, fixed, finished and hosted FilsPay.</p><ul class="l">{owners}</ul>
<p class="kpis"><span><b>84</b> bugs fixed</span><span><b>389</b> API tests passing</span><span><b>Refunds</b> end to end</span><span><b>Live</b> on Dilmune</span></p>
<p class="small">Fork: {E(cfg['fork'])} &#183; commit {E(cfg['commit'])} &#183; http://{E(cfg['ip'])}/dashboard</p>''', 1)
slide("Root cause", '''<p class="big">The team trusted claims instead of checking them.</p>
<p>Comments, postmortems, ADR quotes, pasted AI answers and the repo's own AI instruction files said: money is &#8220;cents&#8221;, days are &#8220;UTC&#8221;, &#8220;Math.random is fine for OTPs&#8221;, &#8220;float32 is fine&#8221;, &#8220;refunds must stay 501&#8221;. The code was built to match.</p>
<table><tr><th>Symptom it explains</th><th>#</th></tr>
<tr><td>4.75 BD imported as 0.475 BD</td><td>6</td></tr><tr><td>Delta paid 1 fils short on 13 days (their own export)</td><td>15</td></tr>
<tr><td>OTP brute-forceable</td><td>30</td></tr><tr><td>Settlement at 03:15, days closed early, filters 3 h off</td><td>3, 60, 75</td></tr>
<tr><td>May incident blamed on the wrong cause</td><td>8</td></tr></table>
<p class="small">Second cause: money paths read-then-write without locks, and trusted the client (time, merchant id).</p>''', 2)
slide("Key findings, ranked by impact", '''<table>
<tr><th>#</th><th>Finding</th><th>Evidence</th></tr>
<tr><td>4</td><td>A password alone logged you in &#8212; OTP skipped</td><td>Test: session usable before OTP on the original code</td></tr>
<tr><td>8</td><td>One payment link charged two customers</td><td>Postmortem appendix: 16 of 17 transactions had one callback &#8212; timeout, not callbacks</td></tr>
<tr><td>10</td><td>Two refunds at the same moment both paid out</td><td>Concurrent test: two 200s on the original code</td></tr>
<tr><td>17</td><td>Every <code>docker compose up</code> wiped the database</td><td>Seed job ran on every start; now refuses if data exists</td></tr>
</table><p class="small">Also: secrets in GitHub (#18), suspended shops still taking payments (#65), one shop's failure blocking everyone's payout (#77).</p>''', 3)
slide("Fixes and proof", '''<ul class="l"><li><b>Smallest fix at the source</b>, one commit each, pushed to our fork.</li>
<li><b>Nearly every fix has a test that fails on the original code</b> (the few without one are named in the document) &#8212; <code>scripts/ai/prove-fix.sh</code> runs it with the fix and with the fix stashed.</li>
<li>Final run on a fresh, seeded database: <b>API 389/389</b>, reporting 14/14, dashboard 9/9, money/events/scripts 51/51, Go all packages, 0 type errors.</li>
<li>Before/after examples: concurrent refunds 2 succeed &#8594; 1; webhook double-send 10 &#8594; 5; image bomb 157 MB &#8594; refused in 3 ms; reconciliation gap &#8722;3,900 fils &#8594; 0.</li>
<li>Every ledger entry group balanced after every load test.</li></ul>''', 4)
slide("Live demo: full and partial refund", f'''<div class="row"><div>{img(S+'after_partial.png',250)}<p class="small">Refund 100.000 BD of 473.457 BD &#8594; partially_refunded</p></div><div>{img(S+'after_full.png',250)}<p class="small">Refund the rest &#8594; refunded, button gone</p></div></div>
<div class="row"><div>{img(S+'after_reconciliation_fixed.png',170)}<p class="small">Reconciliation: no gap</p></div><div><p>Fee reversals 1.800 + 6.722 BD, ledger balanced. Refunds settle in the next batch (oldest first, never a negative payout) and send a <code>refund.succeeded</code> webhook.</p></div></div>''', 5)
slide("Under load", '''<div class="row"><div><p><b>Architecture</b>: nginx (:80 dashboard + checkout, :8080 admin) &#8594; API (:3000) &#8594; Postgres (127.0.0.1); settlement daemon and reporting worker internal. One command: <code>bash ops/deploy.sh</code>.</p>
<p><b>Estimate</b>: ~33 pay-capture-refund flows/s, ~1,900 reads/s on 1 vCPU &#8776; 1,000 concurrent shoppers.</p></div>
<div><table><tr><th>Run</th><th>Req/s</th><th>p95</th></tr><tr><td>Pool 5, 100 users</td><td>30</td><td>8.2 s</td></tr><tr><td>Pool 20, 100 users</td><td>104</td><td>1.7 s</td></tr><tr><td>400 users, no shedding</td><td>120</td><td>8.9 s</td></tr><tr><td>400 users, shedding</td><td>405</td><td>1.4 s</td></tr></table></div></div>
<p><b>Overload</b>: past 100 requests in flight &#8594; instant <code>503 + Retry-After</code>, health checks never shed, recovers with no restart. Bottleneck: the acquirer call (100&#8211;400 ms) inside a DB transaction.</p>''', 6)
slide("How we used AI", '''<p class="big">Claude as an agent with repo, shell, Postgres and a browser &#8212; and a rule: every claim gets checked.</p>
<p>Setup in the fork: <code>CLAUDE.md</code> (verified rules), <code>.claude/settings.json</code> (permissions: no force-push, no reading secrets), <code>.claude/commands/</code>, <code>scripts/ai/</code>.</p>
<p><b>When the AI was wrong</b>: for #78 it set a one-file limit in the upload plugin. Our test expected a 400 and got a <b>500</b> (<code>ERR_STREAM_PREMATURE_CLOSE</code>). We moved the check into the route &#8594; 400.</p>
<p class="small">Also: the repo's inherited AI instruction files were wrong in 13 ways (#83), and our own first refund-settlement code had a gap a test caught (#62).</p>''', 7)
slide("Decisions and open risks", '''<table><tr><th>Chose</th><th>Why</th></tr>
<tr><td>Login page shows the one-time code on the demo server</td><td>No email/SMS provider: otherwise nobody can sign in</td></tr>
<tr><td>Cookies not Secure</td><td>Plain HTTP server; add TLS and switch back</td></tr>
<tr><td>Did not rewrite past money data</td><td>Needs finance sign-off; queries listed to find affected rows</td></tr>
<tr><td>Left the partner v1 tree and packages/money alone</td><td>HANDOVER says so; money package is correct</td></tr></table>
<p><b>Still open</b>: acquirer call inside the DB transaction; scheme rounding residue; no login rate limit; dedicated race test for #8.</p>''', 8)
appendix = f'''<section><div class="num">A</div><h1>Appendix (not presented)</h1>
<ul class="l small"><li>Submission document: TeamKARA_FilsPay_Submission.pdf (84 findings with symptom, root cause, fix, proof, effect on data).</li>
<li>Load test report: docs/perf/team-kara-loadtest-2026-10-30.md; tools: autocannon, scripts/ai/loadtest-flow.mjs.</li>
<li>AI instructions review: docs/audit/ai-instructions-review.md.</li>
<li>Ledger check after every run: <code>SELECT entry_group_id FROM ledger_entries GROUP BY 1 HAVING SUM(CASE WHEN direction='debit' THEN amount_fils ELSE -amount_fils END) &lt;&gt; 0</code> &#8594; 0 rows.</li></ul>
<div class="row"><div>{img(S+'before_txn.png',200)}<p class="small">Before: no refund in the dashboard</p></div><div>{img(S+'after_reconciliation.png',200)}<p class="small">Before #80: refunds showed as a &#8722;464.935 BHD gap</p></div></div></section>'''
html_doc = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: 1280px 720px; margin: 0; }}
body {{ margin:0; font-family: Helvetica, Arial, sans-serif; color:#222; }}
section {{ width:1280px; height:720px; box-sizing:border-box; padding:56px 72px; page-break-after:always; position:relative; background:#fff; border-top:14px solid #9B1B30; }}
h1 {{ color:#9B1B30; font-size:40px; margin:0 0 22px; }} p, li, td, th {{ font-size:21px; line-height:1.4; }}
.big {{ font-size:28px; font-weight:bold; }} .small, .small li, .small td {{ font-size:16px; color:#555; }}
table {{ border-collapse:collapse; width:100%; margin:8px 0; }} td, th {{ border:1px solid #ddd; padding:6px 10px; text-align:left; vertical-align:top; }} th {{ background:#f6eaec; }}
.num {{ position:absolute; right:40px; bottom:24px; color:#aaa; font-size:18px; }}
.row {{ display:flex; gap:28px; align-items:flex-start; }} .row > div {{ flex:1; }}
.kpis span {{ display:inline-block; margin-right:28px; font-size:22px; }} .kpis b {{ color:#9B1B30; font-size:30px; }}
code {{ font-family: Menlo, monospace; font-size:0.85em; background:#f4f4f4; padding:0 4px; }} .l li {{ margin-bottom:8px; }}
</style></head><body>{''.join(slides)}{appendix}</body></html>'''
open('/tmp/claude-0/sub/slides.html','w').write(html_doc)
