package booking

// splitEven divides total across n shares in cents.
func splitEven(total Money, n int) []Money {
	per := total / Money(n)
	shares := make([]Money, n)
	for i := range shares {
		shares[i] = per
	}
	return shares
}
