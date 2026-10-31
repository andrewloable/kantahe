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
	"time"

	"github.com/andrewloable/kantahe/server/internal/api"
	"github.com/andrewloable/kantahe/server/internal/app"
	"github.com/andrewloable/kantahe/server/internal/assets"
	"github.com/andrewloable/kantahe/server/internal/config"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/webui"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

// run is the server as a console program: Ctrl+C or SIGTERM stops it.
func run(args []string, stdout io.Writer) int {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return runContext(ctx, args, stdout)
}

// runContext is the server until ctx is cancelled (a console run cancels it on a signal, a Windows service on Stop).
func runContext(ctx context.Context, args []string, stdout io.Writer) int {
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
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	db, err := store.Open(ctx, cfg.DataDir)
	if err != nil {
		logger.Error("cannot open the database", "err", err)
		return 1
	}
	defer db.Close()
	soundFont, err := assets.SoundFontPath(cfg.SoundFont, cfg.DataDir)
	if err != nil {
		logger.Error("cannot prepare the default SoundFont", "err", err)
		return 1
	}
	imp := library.NewImporter(db, cfg.DataDir, cfg.Libraries, logger)
	srv := app.New(cfg, logger)
	mounted, err := mountServices(srv, api.Deps{DB: db, Version: version, Now: time.Now, Logger: logger, TrustedProxies: cfg.TrustedProxies,
		DataDir: cfg.DataDir, Importer: imp, ScoreSeconds: cfg.ScoreSeconds, SoundFont: soundFont, PublicURL: cfg.PublicURL,
		RenderCacheBytes: int64(cfg.RenderCacheGB) << 30})
	if err != nil {
		logger.Error("cannot start the services", "err", err)
		return 1
	}
	defer mounted.Close()
	mountWebUI(srv)
	go mounted.Run(ctx)
	impCtx, stopImporter := context.WithCancel(ctx)
	impDone := make(chan struct{})
	go func() { imp.Run(impCtx); close(impDone) }()

	err = srv.Run(ctx)
	stopImporter()
	select {
	case <-impDone:
	case <-time.After(2 * time.Second):
		logger.Warn("the library importer did not stop in time")
	}
	if err != nil {
		logger.Error("server stopped", "err", err)
		return 1
	}
	return 0
}

// mountServices registers the API and the media routes, which answer cross-origin requests (packaged TV apps
// load from the device and call the server from another origin).
func mountServices(srv *app.App, d api.Deps) (*api.Mounted, error) {
	return api.Mount(srv.HandleAPI, d)
}

// mountWebUI serves the embedded web app for every path the API does not claim. The pattern has no
// method because "GET /" would conflict with the services' method-less prefixes; the handler
// answers other methods with 405 itself.
func mountWebUI(srv *app.App) { srv.Handle("/", webui.Handler()) }

func main() {
	// started by the Windows service manager, the program must speak its protocol; everywhere else this is a no-op
	if code, ok := runAsService(os.Args[1:], os.Stdout); ok {
		os.Exit(code)
	}
	os.Exit(run(os.Args[1:], os.Stdout))
}
