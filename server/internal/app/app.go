// Package app owns the HTTP server that later packages register their routes on.
package app

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/andrewloable/kantahe/server/internal/config"
)

const shutdownTimeout = 10 * time.Second

// App is the HTTP server with its route table.
type App struct {
	cfg    config.Config
	logger *slog.Logger
	mux    *http.ServeMux

	mu   sync.Mutex
	addr string
}

// New builds the app with its built-in routes.
func New(cfg config.Config, logger *slog.Logger) *App {
	a := &App{cfg: cfg, logger: logger, mux: http.NewServeMux()}
	a.Handle("GET /healthz", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	return a
}

// Mux returns the route table.
func (a *App) Mux() *http.ServeMux { return a.mux }

// Handle registers a handler for a ServeMux pattern.
func (a *App) Handle(pattern string, h http.Handler) { a.mux.Handle(pattern, h) }

// Addr returns the listening address once Run has started, or "" before.
func (a *App) Addr() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.addr
}

// Run serves until ctx is cancelled, then shuts down gracefully.
func (a *App) Run(ctx context.Context) error {
	ln, err := net.Listen("tcp", a.cfg.Listen)
	if err != nil {
		return err
	}
	a.mu.Lock()
	a.addr = ln.Addr().String()
	a.mu.Unlock()

	// No Read/WriteTimeout: uploads and streaming RPCs are long-lived.
	srv := &http.Server{Handler: a.mux, ReadHeaderTimeout: 10 * time.Second}
	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()
	a.logger.Info("listening", "addr", a.addr)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	sctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(sctx); err != nil {
		// Long-lived streams outlived the grace period: drop them.
		a.logger.Warn("graceful shutdown timed out, closing connections", "err", err)
		_ = srv.Close()
	}
	if err := <-errc; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
