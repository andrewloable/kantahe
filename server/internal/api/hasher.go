package api

import (
	"context"

	"github.com/andrewloable/kantahe/server/internal/auth"
)

// maxHashers bounds concurrent argon2id work: each hash needs 64 MiB.
const maxHashers = 4

// hasher runs password hashing and verification with bounded concurrency.
type hasher struct {
	sem  chan struct{}
	cost auth.Cost
}

func newHasher(c auth.Cost) *hasher {
	if c == (auth.Cost{}) {
		c = auth.DefaultCost
	}
	return &hasher{sem: make(chan struct{}, maxHashers), cost: c}
}

func (h *hasher) acquire(ctx context.Context) error {
	select {
	case h.sem <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (h *hasher) hash(ctx context.Context, pw string) (string, error) {
	if err := h.acquire(ctx); err != nil {
		return "", err
	}
	defer func() { <-h.sem }()
	return auth.HashWithCost(pw, h.cost)
}

func (h *hasher) verify(ctx context.Context, encoded, pw string) (bool, error) {
	if err := h.acquire(ctx); err != nil {
		return false, err
	}
	defer func() { <-h.sem }()
	return auth.Verify(encoded, pw)
}
