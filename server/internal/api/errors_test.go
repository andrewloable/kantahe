package api

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"

	"connectrpc.com/connect"

	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/users"
)

func TestInternalErrHidesTheCause(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	err := internalErr(logger, "Op", errors.New("SELECT * FROM secrets: disk I/O error"))
	var ce *connect.Error
	if !errors.As(err, &ce) || ce.Code() != connect.CodeInternal || strings.Contains(ce.Message(), "SELECT") {
		t.Fatalf("client error leaks the cause: %v", err)
	}
	if !strings.Contains(logs.String(), "disk I/O error") || !strings.Contains(logs.String(), "Op") {
		t.Fatalf("the cause must be logged: %q", logs.String())
	}
	// an error that already has a code passes through untouched
	coded := newErr(connect.CodeNotFound, "x")
	if internalErr(logger, "Op", coded) != coded {
		t.Fatal("coded errors must pass through")
	}
}

func TestFromUsersMapping(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if connect.CodeOf(fromUsers(logger, "x", users.ErrNotFound)) != connect.CodeNotFound {
		t.Error("ErrNotFound -> NotFound")
	}
	if connect.CodeOf(fromUsers(logger, "x", users.ErrEmailTaken)) != connect.CodeAlreadyExists {
		t.Error("ErrEmailTaken -> AlreadyExists")
	}
	if connect.CodeOf(fromUsers(logger, "x", errors.New("boom"))) != connect.CodeInternal {
		t.Error("other -> Internal")
	}
}

func TestHashConcurrencyIsBounded(t *testing.T) {
	s := NewAuthServer(Deps{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), HashCost: auth.CheapCost}, auth.NewBackoff(nil))
	for i := 0; i < maxHashers; i++ { // occupy every slot
		s.h.sem <- struct{}{}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.h.hash(ctx, "password1"); !errors.Is(err, context.Canceled) {
		t.Fatalf("hash with a cancelled context and no free slot: %v", err)
	}
	if _, err := s.h.verify(ctx, "x", "y"); !errors.Is(err, context.Canceled) {
		t.Fatalf("verify: %v", err)
	}
}

func TestDefaultCostIsUsedWhenUnset(t *testing.T) {
	s := NewAuthServer(Deps{}, auth.NewBackoff(nil))
	if s.h.cost != auth.DefaultCost {
		t.Fatalf("cost = %+v", s.h.cost)
	}
}
