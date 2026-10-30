package scheduler

import (
	"testing"
	"time"
)

// The case file: "settlement closes every day at midnight, Bahrain time".
// At 00:20 Bahrain (21:20 UTC the previous day) "today" must already be the
// new Bahrain day, so yesterday's close is due right after midnight, not at
// 03:00 when the UTC date finally rolls over.
func TestBahrainTodayStartJustAfterBahrainMidnight(t *testing.T) {
	now := time.Date(2026, 3, 15, 21, 20, 0, 0, time.UTC) // 2026-03-16 00:20 Bahrain
	got := bahrainTodayStart(now)
	want := time.Date(2026, 3, 15, 21, 0, 0, 0, time.UTC) // 2026-03-16 00:00 Bahrain
	if !got.Equal(want) {
		t.Fatalf("bahrainTodayStart(%s) = %s, want %s", now, got, want)
	}
}
