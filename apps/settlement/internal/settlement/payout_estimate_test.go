package settlement

import (
	"context"
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// TestUpdateLifetimePayoutMonitoringEstimate_SmallValuesExact proves the
// accumulator is wired correctly: three successive payouts land on the
// exact sum of their net figures.
// FH: float32 exact up to 2^24 so small values are fine; big ones drift but nobody reads it
func TestUpdateLifetimePayoutMonitoringEstimate_SmallValuesExact(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	for _, net := range []money.Fils{1_000, 2_500, 47_500} {
		if err := UpdateLifetimePayoutMonitoringEstimate(ctx, tx, merchantID, net); err != nil {
			t.Fatalf("UpdateLifetimePayoutMonitoringEstimate(%d): %v", net, err)
		}
	}

	var got int64
	err = tx.QueryRow(ctx, `
		SELECT lifetime_net_payout_monitoring_estimate FROM merchants WHERE id = $1
	`, merchantID).Scan(&got)
	if err != nil {
		t.Fatalf("read back estimate: %v", err)
	}
	if got != 51_000 {
		t.Fatalf("lifetime_net_payout_monitoring_estimate = %v, want exactly 51000 (1000 + 2500 + 47500)", got)
	}
}

// Finance: "lifetime payout estimate drifts for high-volume merchants". A
// float32 total drifts once it passes ~16.7M fils; whole fils never do.
func TestUpdateLifetimePayoutMonitoringEstimate_HighVolumeExact(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var want int64
	for i := 0; i < 200; i++ {
		net := money.Fils(1_234_567 + i)
		want += int64(net)
		if err := UpdateLifetimePayoutMonitoringEstimate(ctx, tx, merchantID, net); err != nil {
			t.Fatalf("update: %v", err)
		}
	}
	var got int64
	if err := tx.QueryRow(ctx, `SELECT lifetime_net_payout_monitoring_estimate FROM merchants WHERE id = $1`, merchantID).Scan(&got); err != nil {
		t.Fatalf("read back: %v", err)
	}
	if got != want {
		t.Fatalf("estimate = %d, want exactly %d", got, want)
	}
}
