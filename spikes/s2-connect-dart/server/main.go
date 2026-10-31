// Command server is the test server of spike S2: AuthService.GetServerInfo and a SessionService.WatchState
// that ticks, over plain HTTP, to try the Dart client on phones and TVs.
//
//	go run . -addr :8099
package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
)

type auth struct {
	kantahev1connect.UnimplementedAuthServiceHandler
}

func (auth) GetServerInfo(context.Context, *connect.Request[kantahev1.GetServerInfoRequest]) (*connect.Response[kantahev1.GetServerInfoResponse], error) {
	return connect.NewResponse(&kantahev1.GetServerInfoResponse{Version: "spike", SetupRequired: true}), nil
}

type session struct {
	kantahev1connect.UnimplementedSessionServiceHandler
	tick  time.Duration
	start time.Time
}

// WatchState sends a state at once and then one per tick, with the server time in milliseconds
// since the server started, until the client leaves.
func (s session) WatchState(ctx context.Context, _ *connect.Request[kantahev1.WatchStateRequest], stream *connect.ServerStream[kantahev1.WatchStateResponse]) error {
	send := func() error {
		return stream.Send(&kantahev1.WatchStateResponse{State: &kantahev1.State{ServerTimeMs: time.Since(s.start).Milliseconds()}})
	}
	if err := send(); err != nil {
		return err
	}
	t := time.NewTicker(s.tick)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			if err := send(); err != nil {
				return err
			}
		}
	}
}

func newHandler(tick time.Duration) http.Handler {
	mux := http.NewServeMux()
	mux.Handle(kantahev1connect.NewAuthServiceHandler(auth{}))
	mux.Handle(kantahev1connect.NewSessionServiceHandler(session{tick: tick, start: time.Now()}))
	return mux
}

func main() {
	addr := flag.String("addr", ":8099", "address to listen on (plain HTTP)")
	tick := flag.Duration("tick", time.Second, "time between WatchState messages")
	flag.Parse()
	log.Printf("listening on %s", *addr)
	log.Fatal((&http.Server{Addr: *addr, Handler: newHandler(*tick), ReadHeaderTimeout: 10 * time.Second}).ListenAndServe())
}
