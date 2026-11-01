//go:build windows

package api

import (
	"os"
	"strings"
	"testing"

	"connectrpc.com/connect"

	"github.com/andrewloable/kantahe/server/internal/video"
)

// On Windows a file that something has open cannot be deleted (a player streaming it, a virus scanner). Deleting a video then fails
// with a message that says so, and the video stays whole: the row, the file and the position.
func TestDeleteVideoWhoseFileIsOpenFailsAndKeepsTheVideo(t *testing.T) {
	a := newAdminEnv(t)
	v := a.addVideo(t, "One", 1)
	f, err := os.Open(video.Path(a.dataDir, v.SHA256)) // Go opens files without FILE_SHARE_DELETE
	if err != nil {
		t.Fatal(err)
	}
	err = a.deleteVideo(a.admin.Token, v.ID)
	if connect.CodeOf(err) != connect.CodeFailedPrecondition || !strings.Contains(err.Error(), "in use") {
		f.Close()
		t.Fatalf("err = %v", err)
	}
	if list, _ := a.listVideos(a.admin.Token); len(list.Videos) != 1 {
		f.Close()
		t.Fatalf("the row must stay: %+v", list.Videos)
	}
	f.Close()
	if err := a.deleteVideo(a.admin.Token, v.ID); err != nil {
		t.Fatalf("once the file is closed: %v", err)
	}
}
