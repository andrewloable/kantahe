package session

import "context"

// Subscription delivers the user's state: C holds at most one pending snapshot
// (a newer one replaces an unread older one, so a slow reader never blocks others).
type Subscription struct {
	C      <-chan Snapshot
	ch     chan Snapshot
	a      *actor
	device string
	svc    *Service
	closed bool
}

// broadcast sends the snapshot to every subscriber; the caller holds a.mu.
func (a *actor) broadcast(s Snapshot) {
	for sub := range a.subs {
		select {
		case <-sub.ch: // drop the unread older snapshot
		default:
		}
		select {
		case sub.ch <- s:
		default:
		}
	}
}

// Subscribe registers a device's stream. The device counts as online until the
// subscription is closed; the first snapshot is returned directly.
func (s *Service) Subscribe(ctx context.Context, userID, deviceID string) (*Subscription, Snapshot, error) {
	a := s.lockActor(userID)
	defer a.mu.Unlock()
	if err := s.ensureLoaded(ctx, a); err != nil {
		return nil, Snapshot{}, err
	}
	a.activity = s.cfg.Wall()
	ch := make(chan Snapshot, 1)
	sub := &Subscription{C: ch, ch: ch, a: a, device: deviceID, svc: s}
	a.subs[sub] = struct{}{}
	a.devCount[deviceID]++
	if a.devCount[deviceID] == 1 {
		a.m.SetOnline(deviceID, true)
		a.broadcast(a.snapshot()) // the others see the device come online (the new subscriber gets it as its first message)
	}
	snap := a.snapshot()
	// the caller sends the returned snapshot first; drop the identical one just queued for it
	select {
	case <-ch:
	default:
	}
	return sub, snap, nil
}

// Close ends the subscription; the device goes offline when its last stream closes.
func (sub *Subscription) Close() {
	a := sub.a
	a.mu.Lock()
	defer a.mu.Unlock()
	if sub.closed {
		return
	}
	sub.closed = true
	delete(a.subs, sub)
	a.devCount[sub.device]--
	if a.devCount[sub.device] <= 0 {
		delete(a.devCount, sub.device)
		a.m.SetOnline(sub.device, false)
		a.broadcast(a.snapshot())
	}
}
