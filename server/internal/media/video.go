package media

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"time"

	"github.com/andrewloable/kantahe/server/internal/video"
)

// A signed URL carries its expiry, so a new URL for every request would make a browser fetch every video again. VideoURL therefore
// gives the same URL for the same video and user for hours: the expiry is the next multiple of videoWindow that is at least
// videoMinLife away, so the URL has between 1 and 7 hours left and never more than MaxLifetime.
const (
	videoWindow  = 6 * time.Hour
	videoMinLife = time.Hour
)

var videoIDPattern = regexp.MustCompile(`^v[0-9a-f]{10}$`)

// VideoURL is the signed URL of a background video for a player (GetBackground); every call in the same window returns the same string.
func (s *Service) VideoURL(id, userID string, now time.Time) string {
	w := int64(videoWindow / time.Second)
	t := now.Add(videoMinLife).Unix()
	return s.Sign("/media/video/"+id, userID, time.Unix((t+w-1)/w*w, 0))
}

// PreviewURL is the signed URL for the administrator's preview (ListVideos): one hour, nothing is cached across lists.
func (s *Service) PreviewURL(id, userID string, now time.Time) string {
	return s.Sign("/media/video/"+id, userID, now.Add(videoMinLife))
}

// video serves a stored background video with Range support. A disabled video is served too: the administrator previews it, and a
// list that was fetched before it was switched off keeps working until its URLs expire. The file name comes from the content hash in
// the table, never from the request.
func (s *Service) video(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.Verify(r); !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	id := r.PathValue("id")
	if !videoIDPattern.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	var sha string
	err := s.db.QueryRowContext(r.Context(), `SELECT sha256 FROM videos WHERE id = ?`, id).Scan(&sha)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		s.logger.Error("video lookup failed", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	file := video.Path(s.dataDir, sha)
	if file == "" {
		http.NotFound(w, r)
		return
	}
	// the content never changes under this id: the hash is the ETag, and a cache may keep it for as long as the URL lives
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("ETag", `"`+sha+`"`)
	s.serveFile(w, r, file, "video/mp4", "private, max-age=21600")
}
