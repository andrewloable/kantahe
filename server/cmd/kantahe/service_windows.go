//go:build windows

package main

import (
	"context"
	"io"

	"golang.org/x/sys/windows/svc"
)

const serviceName = "Kantahe"

// runAsService runs the program as a Windows service when the service manager started it: Windows keeps a service
// process only if it speaks the service protocol (otherwise it is killed with error 1053 after thirty seconds). From a
// console it returns false and the program runs as usual.
func runAsService(args []string, stdout io.Writer) (int, bool) {
	if is, err := svc.IsWindowsService(); err != nil || !is {
		return 0, false
	}
	h := &winService{args: args, stdout: stdout}
	if err := svc.Run(serviceName, h); err != nil {
		return 1, true
	}
	return int(h.code), true
}

type winService struct {
	args   []string
	stdout io.Writer
	code   uint32
}

// Execute is called by the service package: it adapts the manager's requests and states to serviceLoop.
func (w *winService) Execute(_ []string, requests <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	cmds := make(chan serviceCommand)
	go func() {
		defer close(cmds) // the manager is gone
		for r := range requests {
			if c, ok := commandOf(r.Cmd); ok {
				cmds <- c
			}
		}
	}()
	w.code = serviceLoop(func(ctx context.Context) int { return runContext(ctx, w.args, w.stdout) }, cmds, func(s serviceState) {
		status <- statusOf(s)
	})
	// a non-zero code of the server is the service-specific exit code the manager shows
	return w.code != 0, w.code
}

func commandOf(c svc.Cmd) (serviceCommand, bool) {
	switch c {
	case svc.Interrogate:
		return svcInterrogate, true
	case svc.Stop:
		return svcStop, true
	case svc.Shutdown:
		return svcShutdown, true
	}
	return 0, false
}

func statusOf(s serviceState) svc.Status {
	switch s {
	case svcStartPending:
		return svc.Status{State: svc.StartPending}
	case svcStopPending:
		return svc.Status{State: svc.StopPending}
	}
	return svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
}
