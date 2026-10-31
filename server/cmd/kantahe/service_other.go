//go:build !windows

package main

import "io"

// runAsService is for Windows only: everywhere else the program is never started by a service manager that needs its protocol.
func runAsService([]string, io.Writer) (int, bool) { return 0, false }
