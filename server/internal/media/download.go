package media

import (
	"database/sql"
	"errors"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/andrewloable/kantahe/server/internal/library"
)

// DownloadLife is how long the address of a song download works.
const DownloadLife = 10 * time.Minute

// maxDownloadName is the longest file name a download suggests, in characters (without the extension).
const maxDownloadName = 120

// DownloadURL is the signed address from which the administrator userID downloads the stored file of a song, and when it expires.
func (s *Service) DownloadURL(number, userID string, now time.Time) (string, time.Time) {
	exp := now.Add(DownloadLife)
	return s.Sign("/media/download/"+number, userID, exp), exp
}

// DownloadName is the name a downloaded song is saved as: "NUMBER - Artist - Title" and the extension (.kar or .karmp3). Every character
// that is not a letter, a digit, a space or one of .-_()',& becomes "_", so that the name can neither leave a folder nor break a
// header, and ".." never occurs.
func DownloadName(number, artist, title, ext string) string {
	clean := func(in string) string {
		var b strings.Builder
		for _, r := range in {
			switch {
			case unicode.IsLetter(r), unicode.IsDigit(r), strings.ContainsRune(" .-_()',&", r):
				b.WriteRune(r)
			default:
				b.WriteRune('_')
			}
		}
		return strings.TrimSpace(strings.ReplaceAll(strings.Join(strings.Fields(b.String()), " "), "..", "_"))
	}
	var parts []string
	for _, p := range []string{number, artist, title} {
		if c := clean(p); c != "" {
			parts = append(parts, c)
		}
	}
	name := strings.Join(parts, " - ")
	if r := []rune(name); len(r) > maxDownloadName {
		name = strings.TrimSpace(string(r[:maxDownloadName]))
	}
	return name + ext
}

// download serves the stored file of a song exactly as it is, as an attachment, for the administrator the address was signed for. The
// signature is for this path only; the user must still be an administrator, so that a demoted one loses the address at once.
func (s *Service) download(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.Verify(r)
	if !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var admin int
	if err := s.db.QueryRowContext(r.Context(), `SELECT admin FROM users WHERE id = ?`, userID).Scan(&admin); err != nil || admin == 0 {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	number, ok := library.CanonicalNumber(r.PathValue("number"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	var path, title, artist string
	err := s.db.QueryRowContext(r.Context(), `SELECT path, display_title, display_artist FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&path, &title, &artist)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		s.logger.Error("download lookup failed", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	name := DownloadName(number, artist, title, strings.ToLower(filepath.Ext(path)))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-store")
	if r.Header.Get("Range") == "" {
		s.logger.Info("song downloaded", "number", number, "user", userID)
	}
	http.ServeContent(w, r, "", st.ModTime(), f)
}
