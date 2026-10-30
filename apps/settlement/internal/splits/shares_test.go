package splits

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

func TestChildShares_SumToNet(t *testing.T) {
	cases := []struct {
		name       string
		netPayout  money.Fils
		weightsBps []int64
	}{
		{"two equal", 10000, []int64{5000, 5000}},
		{"three round", 9000, []int64{3000, 3000, 4000}},
		{"single child", 5000, []int64{10000}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			children := make([]ChildWeight, len(tc.weightsBps))
			for i, w := range tc.weightsBps {
				children[i] = ChildWeight{WeightBps: w}
			}
			shares := ChildShares(tc.netPayout, children)
			var total money.Fils
			for _, s := range shares {
				total += s
			}
			if total != tc.netPayout {
				t.Errorf("sum of shares %d != net payout %d", total, tc.netPayout)
			}
		})
	}
}

// Finance: Delta Marketplace's three child payouts never add up to the
// parent's total. Odd amounts with the real 50/30/20 split must sum exactly.
func TestChildShares_OddAmountsSumExactly(t *testing.T) {
	children := []ChildWeight{{5000}, {3000}, {2000}}
	for net := money.Fils(1); net <= 5000; net++ {
		var total money.Fils
		for _, s := range ChildShares(net, children) {
			total += s
		}
		if total != net {
			t.Fatalf("net %d: shares sum to %d", net, total)
		}
	}
}
