//go:build !windows

package fsutil

import "path/filepath"

// resolve follows every symlink of an absolute path.
func resolve(abs string) (string, error) { return filepath.EvalSymlinks(abs) }
