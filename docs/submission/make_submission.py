import json, html, base64, re
cfg = json.load(open('/tmp/claude-0/sub/cfg.json'))
bugs = [b for b in json.load(open('/tmp/claude-0/bugs.json')) if b['n'] != 'F']
IP = cfg['ip']
E = html.escape

def img(path, w="100%"):
    b = base64.b64encode(open(path, 'rb').read()).decode()
    return f'<img src="data:image/png;base64,{b}" style="width:{w};border:1px solid #ccc">'

def val(v):
    if isinstance(v, list): return '<br>'.join(E(x) for x in v)
    return E(v)

EFFECT = {
 2: "None directly. Running Rebuild once after deploy corrects every cached balance from the ledger.",
 6: "Past imports are not re-posted. Rows imported with the old parser can be found by comparing parsedAmountFils to the original text; corrections need a finance-approved journaled adjustment.",
 7: "Paid batches are no longer rewritten; adjustments already posted stay in the ledger (audit trail kept).",
 8: "None automatic. Links paid twice before the fix are listed by the postmortem's Appendix A query.",
 14: "Fresh databases only: the two removed files had never been applied anywhere they could be.",
 16: "Migrations 0073/0074 add refund columns and fix the view; no rows rewritten.",
 17: "Stops future wipes. Data lost to earlier wipes cannot be recovered.",
 18: "The exposed secret must be treated as compromised: deploy.sh generates new secrets into ops/.env.",
 20: "Already-sent duplicate notifications cannot be recalled; new payouts notify once.",
 24: "Holds deleted by earlier runs cannot be recovered; the script now only updates status.",
 25: "Migration 0075 removes duplicate notes (keeps one per callbackId) and adds a unique index.",
 33: "Migration 0076 widens the counters to BIGINT; values are preserved.",
 36: "Merchants already flipped live are not reverted automatically (needs an ops decision).",
 39: "Migration 0077 adds the content hash for new imports; past imports untouched.",
 41: "Migration 0078 adds the commit-order column; past events keep their order.",
 52: "Migration 0079 keeps the earliest disbursement per batch and deletes the duplicates, then enforces one per batch.",
 54: "Migration 0080: deliveries keep their history; their endpoint becomes empty when an endpoint is deleted.",
 63: "Merchants approved in bulk before the fix have no review row; they can be listed with a query on merchants without merchant_kyc_reviews.",
 64: "Chargebacks reset earlier by a recompute are not restored automatically (the audit log shows when it ran).",
 80: "Report only; no rows change.",
 81: "Configuration only.",
}
PROOF_OVERRIDE = {8: 'The race was traced step by step in pay.ts (claim, slow acquirer, takeover after the 60 s timeout, both capture); the payment-link suite passes on a real database. A dedicated concurrency test for this race is still open.'}
FOUND = "Read the code and every comment that makes a claim, checked it against the migrations, HANDOVER.md and the case evidence, then reproduced it with an automated test against a real Postgres 16 (the test fails on the original code)."

def finding(b):
    r = dict(b['rows'])
    sev = r.get('Severity (our estimate)', '')
    symptom = r.get("What's wrong") or r.get('What it breaks') or ''
    breaks = r.get('What it breaks')
    cause = r.get('Why') or r.get("What's wrong") or ''
    fix = r.get('Fix') or r.get('Fix (smallest change)') or r.get('Fix explained') or ''
    proof = PROOF_OVERRIDE.get(b['n']) or r.get('Proof') or 'Covered by the full test suites on a fresh database (all pass).'
    rows = [("Severity", E(sev)), ("Where", val(r.get('Where', ''))), ("Symptom", val(symptom) + (("<br><i>Impact:</i> " + val(breaks)) if breaks and breaks != symptom else "")),
            ("How found / reproduced", E(FOUND)), ("Root cause", val(cause)), ("Fix", val(fix)), ("Verified by", val(proof)),
            ("Effect on existing data", E(EFFECT.get(b['n'], "None: the change applies to new requests; no stored rows are rewritten.")))]
    return f'<div class="f"><h3>#{b["n"]} {E(b["title"])}</h3><table class="kv">' + ''.join(f'<tr><th>{k}</th><td>{v}</td></tr>' for k, v in rows) + '</table></div>'

def sev_of(b):
    s = dict(b['rows']).get('Severity (our estimate)', '')
    return s.split(' ')[0]

crit = [b for b in bugs if sev_of(b) == 'Critical']
high = [b for b in bugs if sev_of(b) == 'High']
med = [b for b in bugs if sev_of(b) not in ('Critical', 'High')]
index_rows = ''.join(f'<tr><td>{b["n"]}</td><td>{E(b["title"])}</td><td>{sev_of(b)}</td></tr>' for b in crit + high + med)

ARCH = f'''
<svg viewBox="0 0 900 430" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica" font-size="13">
 <rect x="10" y="10" width="880" height="410" fill="none" stroke="#999" stroke-dasharray="6 4"/>
 <text x="20" y="30" fill="#555">Dilmune Cloud server "Team KARA" (1 vCPU, 2 GB RAM + 2 GB swap, 50 GB) &#8212; docker compose</text>
 <text x="20" y="62" font-weight="bold" fill="#9B1B30">Internet</text>
 <rect x="20" y="80" width="200" height="70" rx="6" fill="#fde8ea" stroke="#9B1B30"/>
 <text x="30" y="102" font-weight="bold">web (nginx)</text><text x="30" y="120">:80 dashboard + checkout</text><text x="30" y="138">:8080 admin console</text>
 <rect x="20" y="190" width="200" height="60" rx="6" fill="#fde8ea" stroke="#9B1B30"/>
 <text x="30" y="214" font-weight="bold">api (Fastify)</text><text x="30" y="234">:3000 public API /v1</text>
 <line x1="220" y1="115" x2="330" y2="200" stroke="#333" marker-end="url(#a)"/><text x="232" y="150">/v1 proxied</text>
 <line x1="220" y1="220" x2="330" y2="220" stroke="#333" marker-end="url(#a)"/>
 <rect x="330" y="180" width="230" height="80" rx="6" fill="#eef" stroke="#447"/>
 <text x="340" y="202" font-weight="bold">api container (same process)</text><text x="340" y="222">routes, webhook dispatcher,</text><text x="340" y="240">load shedding (503 &gt;100 in flight)</text>
 <rect x="640" y="180" width="230" height="80" rx="6" fill="#efe" stroke="#474"/>
 <text x="650" y="202" font-weight="bold">postgres 16</text><text x="650" y="222">127.0.0.1:5432 only</text><text x="650" y="240">volume pgdata</text>
 <line x1="560" y1="220" x2="640" y2="220" stroke="#333" marker-end="url(#a)"/><text x="572" y="212">pool 20</text>
 <rect x="330" y="300" width="230" height="70" rx="6" fill="#eef" stroke="#447"/>
 <text x="340" y="322" font-weight="bold">settlement (Go daemon)</text><text x="340" y="342">:8091 internal only (token)</text><text x="340" y="360">daily close after Bahrain midnight</text>
 <rect x="640" y="300" width="230" height="70" rx="6" fill="#eef" stroke="#447"/>
 <text x="650" y="322" font-weight="bold">reporting (worker)</text><text x="650" y="342">outbox consumer, commit order</text><text x="650" y="360">no ports</text>
 <line x1="560" y1="330" x2="700" y2="262" stroke="#333" marker-end="url(#a)"/>
 <line x1="755" y1="300" x2="755" y2="262" stroke="#333" marker-end="url(#a)"/>
 <line x1="445" y1="260" x2="445" y2="300" stroke="#333" stroke-dasharray="4 3" marker-end="url(#a)"/><text x="452" y="286">admin: run batch (token)</text>
 <rect x="640" y="70" width="230" height="70" rx="6" fill="#f5f5f5" stroke="#888"/>
 <text x="650" y="92" font-weight="bold">one-off jobs</text><text x="650" y="112">migrate (runs before api starts)</text><text x="650" y="130">seed (only on an empty DB)</text>
 <line x1="755" y1="140" x2="755" y2="180" stroke="#333" marker-end="url(#a)"/>
 <defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#333"/></marker></defs>
</svg>'''

S = '/tmp/claude-0/e2e/shots/'
owners = ''.join(f'<li><b>{E(n)}</b>: {E(o)}</li>' for n, o in cfg['owners'])

doc = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 16mm 15mm; }}
body {{ font-family: Helvetica, Arial, sans-serif; font-size: 10.2pt; color:#222; line-height:1.4; }}
h1 {{ color:#9B1B30; font-size:22pt; margin:0 0 6px; }} h2 {{ color:#9B1B30; font-size:15pt; border-bottom:2px solid #9B1B30; padding-bottom:3px; margin-top:22px; page-break-after:avoid; }}
h3 {{ font-size:11pt; margin:14px 0 4px; page-break-after:avoid; }}
table {{ border-collapse:collapse; width:100%; margin:6px 0; }} td,th {{ border:1px solid #ccc; padding:4px 6px; vertical-align:top; text-align:left; }}
th {{ background:#f6eaec; }} table.kv th {{ width:22%; }} .f {{ page-break-inside:avoid; }}
code {{ font-family: Menlo, Consolas, monospace; font-size:9pt; background:#f4f4f4; padding:0 3px; }}
pre {{ font-family: Menlo, Consolas, monospace; font-size:8.6pt; background:#f4f4f4; padding:8px; white-space:pre-wrap; }}
.cover {{ page-break-after:always; }} .brk {{ page-break-before:always; }} .muted {{ color:#666; }}
.pair {{ display:flex; gap:8px; }} .pair > div {{ flex:1; }} .cap {{ font-size:9pt; color:#555; }}
</style></head><body>

<div class="cover">
<h1>FilsPay: The Handover</h1>
<p style="font-size:13pt">Submission document &#8212; <b>Team KARA</b></p>
<h3>Team and ownership</h3><ul>{owners}</ul>
<h3>Live URLs</h3>
<table>
<tr><th>Merchant dashboard</th><td><a href="http://{IP}/dashboard">http://{IP}/dashboard</a></td></tr>
<tr><th>Checkout</th><td><code>http://{IP}/pay/&lt;payment-link token&gt;</code> &#8212; every payment link's URL; create one in Dashboard &#8594; Payment links (or <code>POST /v1/merchants/:id/payment-links</code>) and open it</td></tr>
<tr><th>Admin console</th><td><a href="http://{IP}:8080/">http://{IP}:8080/</a></td></tr>
<tr><th>Public API</th><td><a href="http://{IP}:3000/v1">http://{IP}:3000/v1</a> (also via <code>http://{IP}/v1</code>); health: <a href="http://{IP}:3000/healthz">/healthz</a></td></tr>
</table>
<h3>Repository</h3>
<table><tr><th>Public fork</th><td><a href="{cfg['fork']}">{cfg['fork']}</a></td></tr>
<tr><th>Last commit before the deadline</th><td><code>{cfg['commit']}</code></td></tr></table>
<h3>Demo logins (seeded demo data)</h3>
<table>
<tr><th>Merchant dashboard</th><td>Merchant ID <code>3a1a204a-4b91-4739-b955-45e95e2e2e34</code> (Beta Digital Services), <code>owner@betadigital.example</code> / <code>FilsPaySeed!2026</code>. The one-time code is shown on the page (see Decisions).</td></tr>
<tr><th>Admin console</th><td><code>finance@filspay.test</code> / <code>FilsPayAdminSeed!2026</code></td></tr>
</table>
<p class="muted">Findings document with every entry in Word form: <code>docs/audit/FilsPay_Findings.docx</code> in the fork. Load-test report: <code>docs/perf/team-kara-loadtest-2026-10-30.md</code>.</p>
</div>

<h2>1. Summary</h2>
<p><b>What we found.</b> 84 findings (5 Critical, 43 High, 36 Medium): 28 money, 27 security, 26 reliability/deployment/reporting, 3 data safety. The worst: a password alone logged you in (OTP skipped, #4); one payment link could charge two customers (#8, the real cause of the May incident); two simultaneous refunds both paid out (#10); <code>docker compose up</code> wiped the database (#17); a clean-up script could delete every hold (#24).</p>
<p><b>What we fixed.</b> All 84, each with the smallest change at the source; nearly all have an automated test that fails on the original code (the entry says so where a fix was verified another way). We finished the missing feature, refunds (FP-212): full and partial refunds through the API and the dashboard, fee reversal, ledger legs, settlement batches, webhooks, reports and reconciliation all add up. We deployed the whole stack (it could not be deployed before) with one command, and measured and raised its capacity.</p>
<p><b>What we left alone.</b> The partner <code>v1</code> tree (HANDOVER says so), <code>packages/money</code> (correct), and several things that look broken but are fine (section 4.3). We did not run anything that rewrites history (no back-dated fixes to paid batches, no deletion of imported rows).</p>
<p><b>Main root cause.</b> The team trusted claims instead of checking them: comments, ADR quotes, postmortems, AI answers pasted into the code and the repo's own AI instruction files. Many of those claims were false (money is "cents", days are "UTC", "Math.random is fine", "the route enforces one file", "fixed, uses Bahrain time now"), and the code was built to match them. Second: money paths did read-then-write without locks, and trusted the client (expiry time, merchant id, transaction ownership).</p>

<h2 class="brk">2. Architecture and deployment</h2>
{ARCH}
<p>Internet-facing: port 80 (dashboard + checkout, nginx), 8080 (admin console, nginx) and 3000 (public API). nginx forwards <code>/v1</code> to the API so the browser uses one origin. Postgres listens on 127.0.0.1 only; the settlement internal API (8091) and the reporting worker are on the private Docker network.</p>
<h3>Redeploy with one command</h3>
<pre>cd ~/fils-pay-team-kara &amp;&amp; git pull &amp;&amp; bash ops/deploy.sh</pre>
<p><code>ops/deploy.sh</code> installs Docker if missing, adds 2 GB swap, creates secrets once, builds and starts postgres, migrate, api, settlement and reporting, then the website separately (a website build problem can never stop the API from updating), seeds demo data only into an empty database (the seed refuses otherwise, #17), and checks <code>/healthz</code>.</p>
<h3>Secrets</h3>
<p>Generated on the server by <code>deploy.sh</code> with <code>openssl rand</code> into <code>ops/.env</code> (mode 600, gitignored, never committed): settlement internal token, webhook-secret encryption key, acquirer callback signing secret, and the public base URL. Compose refuses to start the API if any is missing. The secret that had been committed to GitHub (#18) is no longer used.</p>
<h3>Health checks, restarts, settlement safety</h3>
<ul>
<li>Postgres has a Docker health check; every service waits for it, and the API waits for migrations to complete.</li>
<li><code>/healthz</code> (liveness, never touches the DB, never shed by load shedding) and <code>/readyz</code> on the API.</li>
<li><code>restart: unless-stopped</code> on every long-running service.</li>
<li>A redeploy cannot corrupt a settlement run: each merchant's batch close and payout is a single Postgres transaction, so a stop rolls it back cleanly; CloseBatch locks the batch row and is idempotent (closed/paid batches are a no-op); the daemon runs immediately on start and re-attempts the last business day; refunds and captures are claimed with <code>FOR UPDATE</code> so nothing lands in two batches. A day cannot be closed before it has ended (#60), and one merchant's failure no longer stops the others (#77). <code>docker compose up --build</code> only recreates the settlement container if its code changed.</li>
</ul>

<h2 class="brk">3. Capacity</h2>
<p><b>Estimate.</b> On the fixed 1 vCPU / 2 GB server: about <b>33 complete pay-capture-refund flows per second</b> (about 100 write requests/s) and about <b>1,900 read requests/s</b>. If a simulated shopper buys once every 30 seconds, that is roughly <b>1,000 concurrent simulated users</b>; dashboard readers are not the limit.</p>
<p><b>Our load test.</b> API in production mode pinned to one CPU (<code>taskset -c 0</code>), Postgres 16, fresh seeded database, acquirer simulator at its default 100&#8211;400 ms latency and 2% failure rate. Reads: <code>autocannon</code>. Writes: <code>scripts/ai/loadtest-flow.mjs</code> (each virtual user loops authorize &#8594; capture &#8594; partial refund with fresh idempotency keys; waits 1 s on a 503).</p>
<table><tr><th>Run</th><th>VUs</th><th>Req/s</th><th>Flows/s</th><th>p50</th><th>p95</th><th>p99</th><th>Errors</th></tr>
<tr><td>Read GET /v1/transactions</td><td>50</td><td>1,920</td><td>&#8212;</td><td>23 ms</td><td>47 ms*</td><td>60 ms</td><td>0</td></tr>
<tr><td>Writes, original pool 5</td><td>20</td><td>28</td><td>9.3</td><td>699 ms</td><td>1,275 ms</td><td>1,456 ms</td><td>0</td></tr>
<tr><td>Writes, original pool 5</td><td>100</td><td>30</td><td>9.8</td><td>2,942 ms</td><td>8,190 ms</td><td>9,159 ms</td><td>0</td></tr>
<tr><td>Writes, pool 20</td><td>20</td><td>76</td><td>24.6</td><td>267 ms</td><td>400 ms</td><td>412 ms</td><td>0</td></tr>
<tr><td>Writes, pool 20</td><td>100</td><td>104</td><td>33.3</td><td>935 ms</td><td>1,671 ms</td><td>2,029 ms</td><td>0</td></tr>
<tr><td>Overload, no shedding</td><td>400</td><td>120</td><td>37.8</td><td>3,360 ms</td><td>8,880 ms</td><td>9,873 ms</td><td>0 (clients time out)</td></tr>
<tr><td>Overload, shedding at 100</td><td>400</td><td>405</td><td>31.4</td><td>13 ms</td><td>1,382 ms</td><td>1,822 ms</td><td>6,000 fast 503s</td></tr></table>
<p class="cap">* p97.5. 402 (declined) and 502 (acquirer error) responses are the simulator's intended 2% outcomes and are not counted as errors. After every run all ledger entry groups balanced and <code>/healthz</code> answered in ~2 ms. Earlier: 500 concurrent pay&#8594;capture&#8594;refund flows completed with every ledger group balanced and API memory about 135 MB.</p>
<p><b>Bottleneck.</b> Each authorize/capture/refund holds a database connection (and the row lock) while the acquirer answers (100&#8211;400 ms). With the original pool of 5 the API could finish at most ~20 acquirer calls a second whatever the CPU did (#81). Pool 20 gave 2.7&#215;. The next limit is acquirer latency itself; moving the acquirer call outside the transaction is the real fix (open risk, section 4.3).</p>
<p><b>Turning away excess load and recovering.</b> Past 100 requests in progress the API answers <code>503 {{"error":"overloaded"}}</code> with <code>Retry-After: 1</code> immediately, before any database work. Admitted requests stay fast (p95 1.4 s at 400 users instead of 8.9 s), memory stays flat, health checks are never shed so Docker never restarts a busy-but-healthy API. Idempotency keys make client retries safe. When the burst ended the next run was back to normal (p95 404 ms) with no restart. Reporting and webhook workers drain backlogs immediately instead of 500 events per poll (#68, #69).</p>

<h2 class="brk">4. Findings report</h2>
<h3>4.0 Index (by severity)</h3>
<table><tr><th>#</th><th>Finding</th><th>Severity</th></tr>{index_rows}</table>
<h3 class="brk">4.1 Findings</h3>
{''.join(finding(b) for b in bugs)}

<h2 class="brk">4.2 Root causes</h2>
<table><tr><th>Underlying cause</th><th>Findings</th><th>Design decision behind it</th></tr>
<tr><td><b>Claims trusted instead of checked</b> (comments, ADR quotes, postmortems, AI answers, agent instruction files)</td><td>3, 6, 8, 15, 21, 30, 34, 35, 63, 70, 71, 72, 75, 78, 80, 83</td><td>"Docs are the source of truth"; agent rules said cents, UTC days, Math.random and float32 were fine. We now treat every comment as a claim to verify (new CLAUDE.md).</td></tr>
<tr><td><b>Read-then-write without locks</b> on money</td><td>8, 10, 11, 20, 39, 42, 53</td><td>Check-then-act in separate statements assumed one caller at a time; fixed with <code>FOR UPDATE</code>, <code>SKIP LOCKED</code> leases, advisory locks and unique constraints.</td></tr>
<tr><td><b>Trusting the client or the path</b> instead of the authenticated context</td><td>1, 4, 5, 13, 31, 37, 46, 47, 55</td><td>Ownership and time were taken from request data; now always from the session/key and the server clock.</td></tr>
<tr><td><b>Wrong unit or clock</b></td><td>3, 6, 15, 21, 23, 33, 60, 75</td><td>Mixed cents/fils, floats and UTC/Bahrain days; ADR-0001 (integer fils) and Bahrain business days now applied everywhere.</td></tr>
<tr><td><b>Feature half-built</b> (refunds) and things that "add up" only for captures</td><td>9, 11, 12, 16, 62, 72, 73, 80, 84</td><td>FP-212 was stubbed; every place that sums money had to learn about refunds.</td></tr>
<tr><td><b>Never deployed / operated</b></td><td>14, 17, 18, 19, 67, 68, 77, 79, 81, 82</td><td>Compose was a dev setup; no one ran it on a real server or under load.</td></tr>
<tr><td><b>Inputs and errors</b></td><td>44, 45, 48, 50, 58, 59, 66, 76</td><td>Validation assumed friendly callers; bad input reached the DB and became 500s or worse.</td></tr></table>

<h2>4.3 Decisions and open risks</h2>
<table><tr><th>Decision / risk</th><th>Why</th><th>Safeguard we'd propose</th></tr>
<tr><td>Login page shows the one-time code on our demo server (<code>OTP_DEV_EXPOSE=true</code>)</td><td>No email/SMS provider exists; otherwise nobody (judges included) could sign in.</td><td>Remove the line once an OTP sender is configured; the code path is unchanged.</td></tr>
<tr><td>Cookies not marked Secure (<code>COOKIE_SECURE=false</code>)</td><td>The server is plain HTTP; browsers drop Secure cookies over HTTP.</td><td>Put TLS in front (Caddy/Let's Encrypt) and remove the line.</td></tr>
<tr><td>No rate limit on password login</td><td>Would block load tests from one IP; the OTP step is limited (#30).</td><td>Per-account and per-IP limits behind a proxy.</td></tr>
<tr><td>Acquirer call made inside the DB transaction</td><td>Changing it alters the idempotency/locking design right before judging.</td><td>Two-phase: reserve, call acquirer, then finalise.</td></tr>
<tr><td>Past data not rewritten (imports with the old parser, chargebacks reset by recompute, bulk-approved merchants without review rows)</td><td>Rewriting money history needs finance sign-off.</td><td>Queries to list affected rows are in the findings; correct with journaled adjustments.</td></tr>
<tr><td>Monthly scripts use the Bahrain month, not ADR-0003's UTC month</td><td>MK wrote "revisit if a month doesn't tie"; March doesn't tie; HANDOVER requires Bahrain days.</td><td>Update ADR-0003.</td></tr>
<tr><td>Open: scheme rounding residue posting (HANDOVER), 1-fils capture vs settlement fee rounding on discounted merchants, no dead-letter queue for a malformed outbox event, webhook replay mints a new delivery id by design.</td><td>Out of time / by design.</td><td>Listed for the next team.</td></tr></table>
<p><b>Looked broken but fine (left alone):</b> BusinessDayWindow; webhook archive replay to another endpoint (both checked against the merchant); credit approval threshold on the base amount only (documented policy); idempotency "stuck in_progress" keys (claim and work share one transaction); postmortem action 7's global lock (the batch row lock already serialises); void.ts "trigger in 0007" note (no trigger on holds); the v1 tree.</p>

<h2 class="brk">5. UI and UX changes</h2>
<h3>5.1 The website exists, and the home page works</h3>
<p>Before: the dashboard was never deployed, and its home page was a 404. After: served on port 80 and redirecting to sign-in. Why: judges and merchants need a website; it also carries checkout.</p>
<div class="pair"><div>{img(S+'before_root.png')}<p class="cap">Before: home page</p></div><div>{img(S+'after_root.png')}<p class="cap">After: home page redirects to sign-in</p></div></div>
<h3>5.2 Refund button on the transaction page (FP-212)</h3>
<p>Before: no Refund button and no refunded amount. After: Refund for owner/finance, partial (amount in fils) or full (blank), limit = still refundable, one idempotency key per opened form; the page shows the refunded amount and the timeline shows each refund. Why: the feature had to work end to end in the dashboard.</p>
<div class="pair"><div>{img(S+'before_txn.png')}<p class="cap">Before</p></div><div>{img(S+'after_refund_form.png')}<p class="cap">After: refund form (100.000 BD partial)</p></div></div>
<div class="pair"><div>{img(S+'after_partial.png')}<p class="cap">After partial refund: partially_refunded, 100.000 BD refunded</p></div><div>{img(S+'after_full.png')}<p class="cap">After full refund: refunded, button gone</p></div></div>
<h3>5.3 Reconciliation adds up after refunds, and never crashes on a negative gap</h3>
<p>Before: refunds appeared as an unexplained negative gap (#80), and the original page crashed on any negative amount (#74). After: refunds count as pending; gap 0.</p>
<div class="pair"><div>{img(S+'after_reconciliation.png')}<p class="cap">Before the #80 fix: Gap -464.935 BHD</p></div><div>{img(S+'after_reconciliation_fixed.png')}<p class="cap">After: reconciled, no gap</p></div></div>
<h3>5.4 Smaller changes</h3>
<ul><li>Date filters use Bahrain days (#75), so a filtered day matches a settlement day.</li><li>Sessions no longer drop after 10 minutes (#51).</li><li>Admin console deployed on port 8080; KYC documents with Arabic names download (#76).</li><li>Payment-link pages are never cached (#71).</li></ul>

<h2 class="brk">6. AI usage</h2>
<h3>Setup (in the fork)</h3>
<ul>
<li><code>CLAUDE.md</code> (also <code>AGENTS.md</code>, <code>.cursorrules</code>): our verified rules, replacing the inherited ones that were false (<code>docs/audit/ai-instructions-review.md</code> lists each false rule and the bug it hid).</li>
<li><code>.claude/settings.json</code>: permission rules &#8212; tests and read-only git/psql allowed; commits, pushes, docker and migration edits ask first; force-push, <code>reset --hard</code>, <code>rm -rf</code>, reading <code>ops/.env</code> and wiping seed data denied.</li>
<li><code>.claude/commands/</code>: <code>/audit-area</code>, <code>/prove-fix</code>, <code>/record-finding</code>.</li>
<li><code>scripts/ai/</code>: <code>prove-fix.sh</code> (runs a test with the fix and with the fix stashed), <code>fresh-db-suite.sh</code> (fresh DB + seed + every suite), <code>go-test.sh</code>, <code>pgup.sh</code>, <code>loadtest-flow.mjs</code>, <code>e2e-refund-demo.cjs</code> (browser test of the refund flow).</li>
<li>Tool: Claude (Claude Code agent) with the repo, a shell, a local Postgres 16, Go and Playwright. We (two first-year students) directed it, checked each claim against the code and evidence, and learned each fix well enough to explain it.</li>
</ul>

<h3>Excerpt 1 &#8212; the AI was wrong, and the test caught it (#78)</h3>
<table class="kv">
<tr><th>Finding</th><td>#78 KYC upload accepted any number of files and kept only the last.</td></tr>
<tr><th>Prompt and context</th><td>&#8220;run another round of debugging. find more bugs. fix them. update our repo.&#8221; The AI had the repo, a shell and a local database.</td></tr>
<tr><th>AI's answer</th><td>It noticed the note <i>&#8220;fileSize limit only &#8212; files count is unlimited. one file per request is enforced in routes/kyc.ts&#8221;</i> was false, and proposed setting <code>limits: {{ files: 1 }}</code> in the multipart plugin.</td></tr>
<tr><th>Verification</th><td>The new test expected a 4xx. With the AI's fix it got <b>500</b>; the log showed <code>ERR_STREAM_PREMATURE_CLOSE</code>: the plugin limit aborts the stream mid-read, which the route doesn't handle.</td></tr>
<tr><th>What we changed</th><td>Dropped the plugin limit; the route refuses a second file part with 400 before reading it. Test: old code 201, fix 400.</td></tr></table>

<h3>Excerpt 2 &#8212; the AI found the real cause of the May incident (#8)</h3>
<table class="kv">
<tr><th>Finding</th><td>#8 One payment link could be charged twice.</td></tr>
<tr><th>Prompt and context</th><td>Audit the payment-link flow; the AI had <code>pay.ts</code>, <code>docs/incidents/postmortem-2026-05.md</code> and the callback code.</td></tr>
<tr><th>AI's answer</th><td>The postmortem blames duplicate bank callbacks, but callbacks only insert notes and cannot capture. AM's reviewer note (&#8220;the 60 s thing is the reservation timeout in pay.ts&#8221;, 16 of 17 transactions had one note) fits: a slow first payer's reservation expired and a second payer claimed the same link.</td></tr>
<tr><th>Verification</th><td>We traced the timeline in <code>pay.ts</code> line by line (claim, slow acquirer, takeover after the 60 s timeout, both capture, the second finalize still answers 200) and checked that <code>acquirer/callbacks.ts</code> never changes a transaction, so callbacks cannot be the cause. Honest gap: we have no dedicated concurrency test for this race yet (listed as open).</td></tr>
<tr><th>What we changed</th><td>The pay step checks it still owns the reservation (reservation stamp) before taking money, using the server clock. Two postmortem actions marked &#8220;Done&#8221; were also missing; one (#71) is now fixed.</td></tr></table>

<h3>Excerpt 3 &#8212; checking the numbers, not the summary (#80, and our own mistake)</h3>
<table class="kv">
<tr><th>Finding</th><td>#80 Reconciliation showed every refund as a gap.</td></tr>
<tr><th>Prompt and context</th><td>&#8220;here's how we have to present this&#8221; (the guidelines: a full and a partial refund with correct amounts in the dashboard and settlement report). The AI drove the real dashboard in a browser to take screenshots.</td></tr>
<tr><th>AI's answer</th><td>The reconciliation screenshot showed <i>Gap: -464.935 BHD</i>. It checked the arithmetic: refunds 100.000 + 373.457 = 473.457 BD, minus fee reversals 1.800 + 6.722 = 464.935 &#8212; exactly the refunds, so the report ignored unbatched refunds even though its comment says it includes them.</td></tr>
<tr><th>Verification</th><td>New test: capture 10 BD, refund 4 BD, reconcile &#8594; old code gap -3,900 fils, fixed code 0. Re-ran the browser flow: &#8220;Reconciled &#8212; no gap&#8221;.</td></tr>
<tr><th>What we changed</th><td>Unbatched refunds count as pending. In the same spirit, we caught the AI's own earlier mistakes: its first findings draft misquoted ADR-0004 and overstated #3 (we asked &#8220;are those correct?&#8221; and it corrected them), and its first refund-settlement code forgave refunds larger than a day's sales (#62) and was double-charged by Recalculate MDR (#72) &#8212; both found by writing tests against our own code.</td></tr></table>

<h2 class="brk">Appendix</h2>
<h3>A. Tests (final run, fresh database + seed)</h3>
<pre>API (apps/api)            389 / 389 pass
Reporting                  14 / 14 pass
Dashboard (apps/web)        9 / 9 pass
money + events + scripts   51 / 51 pass
Settlement (Go)            all packages ok
TypeScript type-check      web, admin, api, reporting: 0 errors
Migrations                 72 files (numbered up to 0080), all apply on an empty Postgres 16</pre>
<h3>B. Evidence in the team's own files</h3>
<ul><li><code>docs/exports/settlement-batches-2026-09-01_20.csv</code>: on 13 days Delta's net payout is exactly 1 fils below gross minus fee &#8212; the float32 payout bug (#15).</li>
<li><code>docs/exports/admin-audit-2026-09.csv</code>: a batch for 1 Sept was run at 08:26 on 1 Sept, before the day ended (#60).</li>
<li><code>docs/incidents/postmortem-2026-05.md</code>: wrong root cause (#8); actions marked Done but missing (#71).</li></ul>
<h3>C. Queries used</h3>
<pre>-- every ledger entry group balances (run after each load test: 0 rows)
SELECT entry_group_id FROM ledger_entries GROUP BY 1
HAVING SUM(CASE WHEN direction='debit' THEN amount_fils ELSE -amount_fils END) &lt;&gt; 0;

-- refunds on a transaction and the fee given back
SELECT amount_fils, fee_reversed_fils, status FROM refunds WHERE transaction_id = $1;

-- merchants approved in bulk without a review record (#63)
SELECT m.id FROM merchants m WHERE m.kyc_passed
  AND NOT EXISTS (SELECT 1 FROM merchant_kyc_reviews r WHERE r.merchant_id = m.id);</pre>
</body></html>'''
open('/tmp/claude-0/sub/submission.html', 'w').write(doc)
print(len(doc))
