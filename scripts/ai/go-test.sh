#!/usr/bin/env bash
# Run the settlement Go tests. The sandbox could only reach GitHub, so the
# golang.org/x modules are temporarily pointed at their GitHub mirrors and
# go.mod/go.sum are restored afterwards.
set -euo pipefail
cd "$(dirname "$0")/../../apps/settlement"
cp go.mod /tmp/go.mod.bak; cp go.sum /tmp/go.sum.bak
trap 'cp /tmp/go.mod.bak go.mod; cp /tmp/go.sum.bak go.sum' EXIT
go mod edit -replace golang.org/x/crypto=github.com/golang/crypto@v0.31.0 \
            -replace golang.org/x/sync=github.com/golang/sync@v0.10.0 \
            -replace golang.org/x/text=github.com/golang/text@v0.21.0
GOPROXY=direct GOFLAGS=-mod=mod GOSUMDB=off go test -count=1 "${@:-./...}"
