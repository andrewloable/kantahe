// Command kantahe is the Kantahe karaoke server.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/andrewloable/kantahe/server/internal/app"
	"github.com/andrewloable/kantahe/server/internal/config"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func run(args []string, stdout io.Writer) int {
	for _, a := range args {
		if a == "--version" || a == "-version" {
			fmt.Fprintf(stdout, "kantahe %s\n", version)
			return 0
		}
	}
	cfg, err := config.Parse(args, os.Getenv)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, config.Usage())
		return 0
	}
	if err != nil {
		fmt.Fprintf(stdout, "kantahe: %v\n", err)
		return 2
	}
	if err := os.MkdirAll(cfg.DataDir, 0o750); err != nil {
		fmt.Fprintf(stdout, "kantahe: cannot create the data directory: %v\n", err)
		return 1
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	db, err := store.Open(ctx, cfg.DataDir)
	if err != nil {
		logger.Error("cannot open the database", "err", err)
		return 1
	}
	defer db.Close()
	if err := app.New(cfg, logger).Run(ctx); err != nil {
		logger.Error("server stopped", "err", err)
		return 1
	}
	return 0
}

func main() { os.Exit(run(os.Args[1:], os.Stdout)) }
