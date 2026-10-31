//go:build windows

package main

import (
	"testing"

	"golang.org/x/sys/windows/svc"
)

func TestCommandsOfTheServiceManager(t *testing.T) {
	for cmd, want := range map[svc.Cmd]serviceCommand{svc.Interrogate: svcInterrogate, svc.Stop: svcStop, svc.Shutdown: svcShutdown} {
		if got, ok := commandOf(cmd); !ok || got != want {
			t.Errorf("commandOf(%v) = %v, %v", cmd, got, ok)
		}
	}
	if _, ok := commandOf(svc.Pause); ok {
		t.Error("Pause is not accepted")
	}
}

func TestStatesReportedToTheServiceManager(t *testing.T) {
	if s := statusOf(svcStartPending); s.State != svc.StartPending || s.Accepts != 0 {
		t.Errorf("StartPending: %+v", s)
	}
	if s := statusOf(svcRunning); s.State != svc.Running || s.Accepts != svc.AcceptStop|svc.AcceptShutdown {
		t.Errorf("Running must accept Stop and Shutdown: %+v", s)
	}
	if s := statusOf(svcStopPending); s.State != svc.StopPending || s.Accepts != 0 {
		t.Errorf("StopPending: %+v", s)
	}
}
