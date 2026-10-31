package main

import (
	"context"
)

// What a service manager can ask of the program, and what the program tells it, kept free of the Windows types so that the
// loop can be tested on every OS; service_windows.go translates.
type serviceCommand int

const (
	svcInterrogate serviceCommand = iota // report the current state again
	svcStop
	svcShutdown // the machine is going down: the same as Stop
)

type serviceState int

const (
	svcStartPending serviceState = iota
	svcRunning
	svcStopPending
)

// serviceLoop runs the server as a service: it reports StartPending, starts run on a goroutine with a context, reports
// Running, and then answers the manager. Stop or Shutdown (or a closed command channel: the manager is gone) cancels the
// context and waits for run to finish; if run returns by itself the service stops too. It returns the exit code of run,
// which is the service-specific exit code the manager shows.
func serviceLoop(run func(ctx context.Context) int, cmds <-chan serviceCommand, report func(serviceState)) uint32 {
	report(svcStartPending)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	exited := make(chan int, 1)
	go func() { exited <- run(ctx) }()
	state := svcRunning
	report(state)
	for {
		select {
		case c, open := <-cmds:
			if open && c == svcInterrogate {
				report(state)
				continue
			}
			state = svcStopPending
			report(state)
			cancel()
			return uint32(<-exited)
		case code := <-exited:
			report(svcStopPending)
			return uint32(code)
		}
	}
}
