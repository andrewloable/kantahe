//go:build windows

package api

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// On Windows a file that something has open cannot be deleted (Go opens files without FILE_SHARE_DELETE). Aborting an upload whose
// partial file is open must still succeed and drop the row; the file is swept by the next cleanup once it is closed.
func TestVideoUploadAbortWithAnOpenPartialFileSucceedsAndTheCleanupFinishesTheJob(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(2*mib, 20, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 0)
	part := filepath.Join(a.dataDir, "videos", ".upload-"+b.UploadId)
	f, err := os.Open(part)
	if err != nil {
		t.Fatal(err)
	}
	if err := a.abort(a.admin.Token, b.UploadId); err != nil {
		t.Fatalf("abort with the file open: %v", err)
	}
	if a.count(t, "video_uploads") != 0 {
		t.Fatal("the row must be gone")
	}
	if _, err := os.Stat(part); err != nil {
		t.Fatalf("the open file cannot be deleted yet: %v", err)
	}
	f.Close()
	a.mounted.uploads.cleanup(context.Background())
	if _, err := os.Stat(part); err == nil {
		t.Fatal("the cleanup must delete the orphan once it is closed")
	}
}

// A player streaming a stored video has it open. Uploading the same bytes again must not try to replace it: the answer is DUPLICATE.
func TestVideoUploadOfAVideoThatAPlayerHasOpenIsADuplicateNotAnError(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(2*mib, 21, testfix.MP4Options{})
	first := a.upload(t, "a.mp4", data)
	var stored string
	if err := a.db.QueryRow(`SELECT sha256 FROM videos WHERE id = ?`, first.Video.Id).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	reader, err := os.Open(filepath.Join(a.dataDir, "videos", stored+".mp4"))
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	again := a.upload(t, "b.mp4", data)
	if again.Status != kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE || again.Video.Id != first.Video.Id {
		t.Fatalf("second upload: %+v", again)
	}
	if files := a.videosDirFiles(t); len(files) != 1 {
		t.Fatalf("files = %v, want only the stored video", files)
	}
}
