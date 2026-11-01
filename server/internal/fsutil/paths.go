package fsutil

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// The server decides what it may delete from path comparisons, so they follow the rules of the file system they are about:
// on Windows paths are case-insensitive, either separator is accepted, a drive letter may be in either case, and the same place
// can be written as C:\Music, c:\music\, \\?\C:\Music or (UNC) \\server\share. Elsewhere paths are compared exactly. The functions
// here compare paths that are absolute; a path that is not is never "under" anything (when in doubt it is not managed).

const onWindows = runtime.GOOS == "windows"

// SamePath reports whether a and b name the same place, by the rules of this system. Both should be canonical (see Canonical).
func SamePath(a, b string) bool { return samePath(a, b, onWindows) }

// IsUnder reports whether p is dir or lies inside it, by the rules of this system. A sibling that shares a prefix (C:\Music2 for
// C:\Music) is not inside it, and ".." is resolved before the comparison.
func IsUnder(p, dir string) bool { return isUnder(p, dir, onWindows) }

func samePath(a, b string, windows bool) bool {
	va, ea, oka := split(a, windows)
	vb, eb, okb := split(b, windows)
	return oka && okb && sameVolume(va, vb, windows) && sameElems(ea, eb, windows) // windows: fold case
}

func isUnder(p, dir string, windows bool) bool { return under(p, dir, windows, windows) }

// IsUnderCanonical is IsUnder for two paths that both come from Canonical: they carry the real case of every element, so the
// elements are compared exactly (only the drive letter, server and share have no case). It cannot be fooled by a Windows folder
// that is case-sensitive, where C:\Music\Sub and C:\Music\sub are different places. This is the one the delete guard uses.
func IsUnderCanonical(p, dir string) bool { return isUnderStrict(p, dir, onWindows) }

func isUnderStrict(p, dir string, windows bool) bool { return under(p, dir, windows, false) }

// under compares the volumes by the rules of the system and the elements case-insensitively only when foldElems says so.
func under(p, dir string, windows, foldElems bool) bool {
	vp, ep, okp := split(p, windows)
	vd, ed, okd := split(dir, windows)
	if !okp || !okd || !sameVolume(vp, vd, windows) || len(ed) > len(ep) {
		return false
	}
	return sameElems(ep[:len(ed)], ed, foldElems)
}

func sameVolume(a, b string, windows bool) bool {
	if windows {
		return strings.EqualFold(a, b)
	}
	return a == b
}

// sameElems compares path elements, without regard to case when fold is true.
func sameElems(a, b []string, fold bool) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if fold && !strings.EqualFold(a[i], b[i]) || !fold && a[i] != b[i] {
			return false
		}
	}
	return true
}

// split cuts an absolute path into its volume ("C:" or "\\server\share" on Windows, "" elsewhere) and its elements, resolving "."
// and ".." lexically (a ".." at the root stays at the root). ok is false for a path that is not absolute.
func split(p string, windows bool) (volume string, elems []string, ok bool) {
	if !windows {
		if !strings.HasPrefix(p, "/") {
			return "", nil, false
		}
		return "", clean(strings.Split(p, "/")), true
	}
	p = stripExtended(strings.ReplaceAll(p, "/", `\`))
	switch {
	case strings.HasPrefix(p, `\\`): // \\server\share\dir
		parts := strings.Split(p[2:], `\`)
		if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
			return "", nil, false
		}
		return `\\` + parts[0] + `\` + parts[1], clean(parts[2:]), true
	case len(p) >= 3 && p[1] == ':' && p[2] == '\\' && isLetter(p[0]): // C:\dir
		return p[:2], clean(strings.Split(p[3:], `\`)), true
	}
	return "", nil, false // C:dir (relative to a drive's current folder), \dir, dir: not absolute
}

func isLetter(c byte) bool { return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' }

// clean drops empty and "." elements and resolves "..".
func clean(parts []string) []string {
	var out []string
	for _, e := range parts {
		switch e {
		case "", ".":
		case "..":
			if len(out) > 0 {
				out = out[:len(out)-1]
			}
		default:
			out = append(out, e)
		}
	}
	return out
}

// stripExtended turns the extended forms of a Windows path into the plain ones: \\?\C:\x to C:\x and \\?\UNC\server\share\x to
// \\server\share\x (also \\.\ ). Anything else is returned as it is.
func stripExtended(p string) string {
	for _, prefix := range []string{`\\?\`, `\\.\`} {
		if strings.HasPrefix(p, prefix) {
			rest := p[len(prefix):]
			if len(rest) >= 4 && strings.EqualFold(rest[:4], `UNC\`) {
				return `\\` + rest[4:]
			}
			return rest
		}
	}
	return p
}

// Canonical returns the absolute path of path with every link resolved, so that two names of one place come out equal and a place
// reached through a link is seen for where it really is. On Windows that includes junctions (Go 1.23 stopped EvalSymlinks from
// following them), 8.3 short names and the real case of every element. The path must exist.
func Canonical(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return resolve(abs)
}

// ResolvesElsewhere reports whether the directory dir, found by walking a folder, is a link (a junction or a symlink) rather than
// the real directory it is named as: its canonical path differs from the path it was found at. Only Windows asks: elsewhere a walk
// never enters a symlinked directory in the first place, and the answer is always false. An error means it could not be judged.
func ResolvesElsewhere(dir string) (bool, error) {
	if !onWindows {
		return false, nil
	}
	c, err := Canonical(dir)
	if err != nil {
		return false, &os.PathError{Op: "resolve", Path: dir, Err: err}
	}
	return !SamePath(c, dir), nil
}
