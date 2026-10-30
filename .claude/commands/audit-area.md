Audit $ARGUMENTS for bugs.

1. Read the files and every comment that makes a claim (developer notes, quoted AI answers, ADR references).
2. For each claim, check it against the code, the migrations (db/migrations) and docs/HANDOVER.md. List which claims are false.
3. Look specifically for: money units (fils vs cents), Bahrain vs UTC days, missing merchant scoping (IDOR), missing row locks, non-crypto randomness, floats, unbounded reads, errors that become 500s.
4. Report candidate bugs with a concrete reproduction. Do not change code yet.
