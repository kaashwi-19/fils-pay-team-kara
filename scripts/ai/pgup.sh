#!/usr/bin/env bash
# Start the local Postgres 16 used for tests (cluster in /tmp/pgdata, socket in /tmp).
psql -h /tmp -U postgres -At -c "select 1" >/dev/null 2>&1 || {
  rm -f /tmp/pgdata/postmaster.pid
  su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -l /tmp/pg.log -o '-k /tmp' start -w" >/dev/null
}
