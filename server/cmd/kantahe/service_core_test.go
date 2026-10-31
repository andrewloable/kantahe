package main

import (
	"bytes"
	"context"
	"net"
	"net/http"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"
)

// recorder collects the states a service loop reports.
type recorder struct {
	mu     sync.Mutex
	states []serviceState
	ch     chan serviceState
}

func newRecorder() *recorder { return &recorder{ch: make(chan serviceState, 16)} }

func (r *recorder) report(s serviceState) {
	r.mu.Lock()
	r.states = append(r.states, s)
	r.mu.Unlock()
	r.ch <- s
}

func (r *recorder) got() []serviceState {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]serviceState(nil), r.states...)
}

func (r *recorder) waitFor(t *testing.T, want serviceState) {
	t.Helper()
	for {
		select {
		case s := <-r.ch:
			if s == want {
				return
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("state %v was not reported; got %v", want, r.got())
		}
	}
}

// loop starts serviceLoop on its own goroutine and returns what it returns on a channel.
func loop(run func(context.Context) int, cmds <-chan serviceCommand, rec *recorder) <-chan uint32 {
	done := make(chan uint32, 1)
	go func() { done <- serviceLoop(run, cmds, rec.report) }()
	return done
}

func finish(t *testing.T, done <-chan uint32) uint32 {
	t.Helper()
	select {
	case code := <-done:
		return code
	case <-time.After(2 * time.Second):
		t.Fatal("the service loop did not return: the server was not asked to stop")
		return 0
	}
}

// blocking is a server that runs until its context is cancelled, like the real one.
func blocking(cancelled *bool, finished *bool) func(context.Context) int {
	return func(ctx context.Context) int {
		<-ctx.Done()
		*cancelled = true
		time.Sleep(30 * time.Millisecond) // a graceful shutdown takes a moment
		*finished = true
		return 0
	}
}

func TestServiceStopReportsStartRunningStopAndCancelsTheServer(t *testing.T) {
	var cancelled, finished bool
	rec, cmds := newRecorder(), make(chan serviceCommand, 1)
	done := loop(blocking(&cancelled, &finished), cmds, rec)
	rec.waitFor(t, svcRunning)
	cmds <- svcStop
	if code := finish(t, done); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if want := []serviceState{svcStartPending, svcRunning, svcStopPending}; !reflect.DeepEqual(rec.got(), want) {
		t.Fatalf("states = %v, want %v", rec.got(), want)
	}
	if !cancelled {
		t.Fatal("the context passed to the server was not cancelled")
	}
	if !finished {
		t.Fatal("the loop returned before the server had finished stopping")
	}
}

func TestServiceShutdownBehavesLikeStop(t *testing.T) {
	var cancelled, finished bool
	rec, cmds := newRecorder(), make(chan serviceCommand, 1)
	done := loop(blocking(&cancelled, &finished), cmds, rec)
	rec.waitFor(t, svcRunning)
	cmds <- svcShutdown
	if code := finish(t, done); code != 0 || !cancelled || !finished {
		t.Fatalf("code %d, cancelled %v, finished %v", code, cancelled, finished)
	}
	if want := []serviceState{svcStartPending, svcRunning, svcStopPending}; !reflect.DeepEqual(rec.got(), want) {
		t.Fatalf("states = %v, want %v", rec.got(), want)
	}
}

func TestServiceThatFailsEarlyStopsWithItsExitCode(t *testing.T) {
	rec, cmds := newRecorder(), make(chan serviceCommand)
	done := loop(func(context.Context) int { return 3 }, cmds, rec)
	if code := finish(t, done); code != 3 {
		t.Fatalf("exit code = %d, want 3: a failed start must not look like a clean stop", code)
	}
	got := rec.got()
	if len(got) == 0 || got[len(got)-1] != svcStopPending {
		t.Fatalf("states = %v, want them to end with StopPending", got)
	}
}

func TestServiceThatEndsByItselfCleanlyStillStops(t *testing.T) {
	rec, cmds := newRecorder(), make(chan serviceCommand)
	done := loop(func(context.Context) int { return 0 }, cmds, rec)
	if code := finish(t, done); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if got := rec.got(); got[len(got)-1] != svcStopPending {
		t.Fatalf("states = %v", got)
	}
}

func TestServiceInterrogateReportsTheCurrentStateAgain(t *testing.T) {
	var cancelled, finished bool
	rec, cmds := newRecorder(), make(chan serviceCommand, 2)
	done := loop(blocking(&cancelled, &finished), cmds, rec)
	rec.waitFor(t, svcRunning)
	cmds <- svcInterrogate
	rec.waitFor(t, svcRunning)
	cmds <- svcStop
	finish(t, done)
	if want := []serviceState{svcStartPending, svcRunning, svcRunning, svcStopPending}; !reflect.DeepEqual(rec.got(), want) {
		t.Fatalf("states = %v, want %v", rec.got(), want)
	}
	if !cancelled {
		t.Fatal("an interrogate must not stop the server, but the later stop must")
	}
}

func TestServiceStopsWhenTheServiceManagerGoesAway(t *testing.T) {
	var cancelled, finished bool
	rec, cmds := newRecorder(), make(chan serviceCommand)
	done := loop(blocking(&cancelled, &finished), cmds, rec)
	rec.waitFor(t, svcRunning)
	close(cmds)
	finish(t, done)
	if !cancelled || !finished {
		t.Fatalf("cancelled %v, finished %v", cancelled, finished)
	}
}

func TestServiceStopThatMakesTheServerFailReportsItsCode(t *testing.T) {
	rec, cmds := newRecorder(), make(chan serviceCommand, 1)
	done := loop(func(ctx context.Context) int { <-ctx.Done(); return 1 }, cmds, rec)
	rec.waitFor(t, svcRunning)
	cmds <- svcStop
	if code := finish(t, done); code != 1 {
		t.Fatalf("exit code = %d, want 1", code)
	}
}

func TestRunContextStopsWhenItsContextIsCancelled(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ln.Close() // a free port for the server

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	out := &bytes.Buffer{}
	done := make(chan int, 1)
	go func() {
		done <- runContext(ctx, []string{"--data", filepath.Join(t.TempDir(), "data"), "--listen", addr}, out)
	}()
	deadline := time.Now().Add(10 * time.Second)
	for {
		if res, err := http.Get("http://" + addr + "/healthz"); err == nil {
			res.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("the server did not start (output %q)", out.String())
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	select {
	case code := <-done:
		if code != 0 {
			t.Fatalf("exit code = %d, want 0 (output %q)", code, out.String())
		}
	case <-time.After(15 * time.Second):
		t.Fatal("runContext did not return after its context was cancelled")
	}
}
