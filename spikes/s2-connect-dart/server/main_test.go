package main

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
)

func TestGetServerInfo(t *testing.T) {
	srv := httptest.NewServer(newHandler(time.Millisecond))
	defer srv.Close()
	client := kantahev1connect.NewAuthServiceClient(srv.Client(), srv.URL)
	res, err := client.GetServerInfo(context.Background(), connect.NewRequest(&kantahev1.GetServerInfoRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	if res.Msg.Version != "spike" || !res.Msg.SetupRequired {
		t.Fatalf("got version %q setup_required %v, want spike and true", res.Msg.Version, res.Msg.SetupRequired)
	}
}

func TestWatchStateSendsTicks(t *testing.T) {
	srv := httptest.NewServer(newHandler(20 * time.Millisecond))
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client := kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL)
	stream, err := client.WatchState(ctx, connect.NewRequest(&kantahev1.WatchStateRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	var times []int64
	for len(times) < 3 && stream.Receive() {
		times = append(times, stream.Msg().State.ServerTimeMs)
	}
	if err := stream.Err(); err != nil {
		t.Fatal(err)
	}
	if len(times) != 3 {
		t.Fatalf("read %d messages, want 3", len(times))
	}
	for i := 1; i < len(times); i++ {
		if times[i] <= times[i-1] {
			t.Fatalf("server_time_ms is not strictly increasing: %v", times)
		}
	}
}

func TestWatchStateEndsWhenTheClientLeaves(t *testing.T) {
	// the next tick is an hour away, so only the context can end the handler
	srv := httptest.NewServer(newHandler(time.Hour))
	ctx, cancel := context.WithCancel(context.Background())
	client := kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL)
	stream, err := client.WatchState(ctx, connect.NewRequest(&kantahev1.WatchStateRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	if !stream.Receive() {
		t.Fatal(stream.Err())
	}
	cancel()
	for stream.Receive() {
	}
	// closing the test server waits for the handler to return: it hangs if the handler ignores the context
	done := make(chan struct{})
	go func() { srv.Close(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the stream handler did not stop when the client left")
	}
}
