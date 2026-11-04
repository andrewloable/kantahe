package transfer

import (
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

// applyStepHook, when set (tests), is called after each step of ApplyPending with the name of the step; an error it returns stops
// ApplyPending there, as a crash would.
var applyStepHook func(step string) error

func step(name string) error {
	if applyStepHook != nil {
		return applyStepHook(name)
	}
	return nil
}

func exists(p string) bool { _, err := os.Lstat(p); return err == nil }

// ApplyPending applies an import that Stage left in <data>/import-pending. The program calls it at start, while no database is open,
// and nothing else may call it. In this order, so that every step can be run again after a crash and the old data is never lost:
//
//  1. the staged song, media and video files move into the data folder (names are the hashes of their content, so a file that is
//     there is the same file and is kept);
//  2. the old database, with its -wal and -shm files, moves to <data>/backups/before-import-<UTC time>;
//  3. the staged database becomes <data>/kantahe.db;
//  4. the staging folder is removed.
//
// The old song files stay where they are. A staging folder without a database is what is left when step 3 was done and step 4 was
// not: it is only removed.
func ApplyPending(dataDir string, now func() time.Time, logger *slog.Logger) error {
	pending := filepath.Join(dataDir, pendingName)
	if !exists(pending) {
		return nil
	}
	staged := filepath.Join(pending, "kantahe.db")
	if !exists(staged) {
		logger.Info("an import was applied; removing what is left of its staging folder")
		return os.RemoveAll(pending)
	}

	for _, dir := range []string{"songs", "media", "videos"} {
		if err := moveFiles(filepath.Join(pending, dir), filepath.Join(dataDir, dir)); err != nil {
			return err
		}
	}
	if err := step("files"); err != nil {
		return err
	}

	var backup string
	for _, name := range []string{"kantahe.db", "kantahe.db-wal", "kantahe.db-shm"} {
		src := filepath.Join(dataDir, name)
		if !exists(src) {
			continue
		}
		if backup == "" {
			var err error
			if backup, err = newBackupDir(dataDir, now()); err != nil {
				return err
			}
		}
		if err := os.Rename(src, filepath.Join(backup, name)); err != nil {
			return err
		}
	}
	if err := step("backup"); err != nil {
		return err
	}

	if err := os.Rename(staged, filepath.Join(dataDir, "kantahe.db")); err != nil {
		return err
	}
	if err := step("swap"); err != nil {
		return err
	}

	if err := os.RemoveAll(pending); err != nil {
		logger.Warn("the staging folder of the import could not be removed", "err", err)
		return nil
	}
	logger.Info("import applied", "backup", backup)
	return nil
}

// moveFiles moves the files of from into to; a file that is there already is the same content and stays, the staged copy goes.
func moveFiles(from, to string) error {
	entries, err := os.ReadDir(from)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := os.MkdirAll(to, 0o750); err != nil {
		return err
	}
	for _, e := range entries {
		if !e.Type().IsRegular() {
			continue
		}
		src, dst := filepath.Join(from, e.Name()), filepath.Join(to, e.Name())
		if exists(dst) {
			if err := os.Remove(src); err != nil {
				return err
			}
			continue
		}
		if err := os.Rename(src, dst); err != nil {
			return err
		}
		_ = os.Chmod(dst, 0o640) // as the files the server stores itself
	}
	return nil
}

// newBackupDir makes <data>/backups/before-import-<UTC time> (with a number after it when the name is taken) and returns it.
func newBackupDir(dataDir string, t time.Time) (string, error) {
	if err := os.MkdirAll(filepath.Join(dataDir, "backups"), 0o700); err != nil {
		return "", err
	}
	base := filepath.Join(dataDir, "backups", "before-import-"+t.UTC().Format("20060102-150405"))
	for n := 0; ; n++ {
		dir := base
		if n > 0 {
			dir = fmt.Sprintf("%s-%d", base, n+1)
		}
		err := os.Mkdir(dir, 0o700)
		if err == nil {
			return dir, nil
		}
		if !errors.Is(err, fs.ErrExist) {
			return "", err
		}
	}
}
