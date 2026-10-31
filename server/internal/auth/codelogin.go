package auth

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"net/netip"
	"strings"
	"sync"
	"time"
)

// CodeAlphabet has no 0, O, 1 or I, so a code read off a TV is not mistyped.
const CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const (
	codeLen         = 6
	codeLifetime    = 5 * time.Minute
	maxCodesPerIP   = 10
	defaultMaxCodes = 10000
)

// Errors of the code store.
var (
	ErrCodeNotFound = errors.New("auth: unknown, used or expired code")
	ErrCodeExpired  = errors.New("auth: code expired")
	ErrTooManyCodes = errors.New("auth: too many pending codes")
	ErrCodeBusy     = errors.New("auth: another stream is already waiting for this code")
)

// Approval is what a TV receives once its code is approved.
type Approval struct {
	UserID     string
	DeviceName string
	DeviceType int32
}

type codeEntry struct {
	loginID, code string
	name          string
	typ           int32
	ipKey         netip.Addr
	expires       time.Time
	approvedBy    string
	approved      chan struct{} // closed on approval
	waiting       bool
}

// CodeLogins holds the pending TV sign-in codes in memory; they are lost on restart by design.
type CodeLogins struct {
	// Set these before use. Poll is how often a waiting stream looks at the clock,
	// PruneEvery the period of Run, MaxPending the cap over all IPs.
	Poll       time.Duration
	PruneEvery time.Duration
	MaxPending int

	now  func() time.Time
	mu   sync.Mutex
	byID map[string]*codeEntry
	byCd map[string]*codeEntry
}

// NewCodeLogins builds an empty store; now defaults to time.Now.
func NewCodeLogins(now func() time.Time) *CodeLogins {
	if now == nil {
		now = time.Now
	}
	return &CodeLogins{
		Poll: time.Second, PruneEvery: time.Minute, MaxPending: defaultMaxCodes,
		now: now, byID: map[string]*codeEntry{}, byCd: map[string]*codeEntry{},
	}
}

// ipKey groups an IPv6 client by its /64, which one subscriber can rotate through freely.
func ipKey(ip netip.Addr) netip.Addr {
	ip = ip.Unmap()
	if ip.Is6() {
		return netip.PrefixFrom(ip, 64).Masked().Addr()
	}
	return ip
}

func randomCode() (string, error) {
	var b [codeLen]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = CodeAlphabet[b[i]&31] // 32 symbols: no modulo bias
	}
	return string(b[:]), nil
}

func randomLoginID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b[:]), nil
}

// Len is the number of entries held (tests).
func (c *CodeLogins) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.byID)
}

// drop removes e, unless it was already pruned and a newer entry took its id or code.
func (c *CodeLogins) drop(e *codeEntry) {
	if c.byID[e.loginID] == e {
		delete(c.byID, e.loginID)
	}
	if c.byCd[e.code] == e {
		delete(c.byCd, e.code)
	}
}

// pruneLocked drops entries past their expiry, approved or not.
func (c *CodeLogins) pruneLocked() {
	now := c.now()
	for _, e := range c.byID {
		if !now.Before(e.expires) {
			c.drop(e)
		}
	}
}

// Prune drops expired entries.
func (c *CodeLogins) Prune() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pruneLocked()
}

// Run prunes every PruneEvery until ctx is done.
func (c *CodeLogins) Run(ctx context.Context) {
	t := time.NewTicker(c.PruneEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			c.Prune()
		}
	}
}

// Start registers a pending sign-in and returns the secret login id, the code to show and its expiry.
func (c *CodeLogins) Start(deviceName string, deviceType int32, ip netip.Addr) (loginID, code string, expires time.Time, err error) {
	key := ipKey(ip)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pruneLocked()
	if len(c.byID) >= c.MaxPending {
		return "", "", time.Time{}, ErrTooManyCodes
	}
	same := 0
	for _, e := range c.byID {
		if e.ipKey == key {
			same++
		}
	}
	if same >= maxCodesPerIP {
		return "", "", time.Time{}, ErrTooManyCodes
	}
	if loginID, err = randomLoginID(); err != nil {
		return "", "", time.Time{}, err
	}
	for {
		if code, err = randomCode(); err != nil {
			return "", "", time.Time{}, err
		}
		if _, taken := c.byCd[code]; !taken {
			break
		}
	}
	e := &codeEntry{
		loginID: loginID, code: code, name: deviceName, typ: deviceType, ipKey: key,
		expires: c.now().Add(codeLifetime), approved: make(chan struct{}),
	}
	c.byID[loginID], c.byCd[code] = e, e
	return loginID, code, e.expires, nil
}

// Approve marks the code approved by the user and returns the TV's device name.
// An unknown, expired or already approved code is ErrCodeNotFound.
func (c *CodeLogins) Approve(code, userID string) (deviceName string, err error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pruneLocked()
	e, ok := c.byCd[code]
	if !ok || e.approvedBy != "" {
		return "", ErrCodeNotFound
	}
	e.approvedBy = userID
	close(e.approved)
	return e.name, nil
}

// Wait blocks until the code is approved (ErrCodeExpired when it ran out first) or ctx is done.
// Only one Wait at a time per login id; the entry is deleted once Wait has returned its result,
// but a Wait that ends because ctx is done leaves it for the TV to reconnect.
func (c *CodeLogins) Wait(ctx context.Context, loginID string) (Approval, error) {
	c.mu.Lock()
	e, ok := c.byID[loginID]
	if !ok {
		c.mu.Unlock()
		return Approval{}, ErrCodeNotFound
	}
	if e.waiting {
		c.mu.Unlock()
		return Approval{}, ErrCodeBusy
	}
	e.waiting = true
	c.mu.Unlock()
	for {
		c.mu.Lock()
		if e.approvedBy != "" {
			c.drop(e)
			c.mu.Unlock()
			return Approval{UserID: e.approvedBy, DeviceName: e.name, DeviceType: e.typ}, nil
		}
		remaining := e.expires.Sub(c.now())
		if remaining <= 0 {
			c.drop(e)
			c.mu.Unlock()
			return Approval{}, ErrCodeExpired
		}
		c.mu.Unlock()
		timer := time.NewTimer(min(remaining, c.Poll))
		select {
		case <-e.approved:
			timer.Stop()
		case <-ctx.Done():
			timer.Stop()
			c.mu.Lock()
			e.waiting = false
			c.mu.Unlock()
			return Approval{}, ctx.Err()
		case <-timer.C:
		}
	}
}
