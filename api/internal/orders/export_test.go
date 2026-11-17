package orders

// SetAfterReserve exposes the fault-injection hook to tests in package orders_test.
func (s *Service) SetAfterReserve(f func() error) { s.afterReserve = f }
