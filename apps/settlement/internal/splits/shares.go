package splits

import (
	"sort"

	"github.com/filspay/settlement/internal/money"
)

// ChildWeight is one sub-merchant's configured share of a parent's payout.
type ChildWeight struct {
	WeightBps int64
}

// ChildShares distributes netPayout across children in proportion to their
// weights so that the shares always add up to exactly netPayout.
//
// Rounding each child's share on its own (the old behaviour) left the odd
// fils unallocated every batch: they were never paid to any child and never
// posted to the ledger (Finance: "the three child payouts don't add up to the
// parent's total"). Largest-remainder method: everyone gets the rounded-down
// share, then the leftover fils go one each to the children with the
// biggest remainders (ties to the earlier child, so the result is stable).
func ChildShares(netPayout money.Fils, children []ChildWeight) []money.Fils {
	out := make([]money.Fils, len(children))
	var totalWeight int64
	for _, c := range children {
		totalWeight += c.WeightBps
	}
	if totalWeight <= 0 || netPayout <= 0 {
		return out
	}
	type rem struct {
		idx int
		r   int64
	}
	rems := make([]rem, len(children))
	var allocated money.Fils
	for i, c := range children {
		product := int64(netPayout) * c.WeightBps
		out[i] = money.Fils(product / totalWeight)
		rems[i] = rem{i, product % totalWeight}
		allocated += out[i]
	}
	sort.SliceStable(rems, func(a, b int) bool { return rems[a].r > rems[b].r })
	for k := 0; allocated < netPayout; k++ {
		out[rems[k%len(rems)].idx]++
		allocated++
	}
	return out
}
