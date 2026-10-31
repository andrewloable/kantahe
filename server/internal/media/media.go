// Package media serves audio over plain HTTP. <audio src> cannot send an
// Authorization header, so songs are fetched with short-lived signed URLs bound
// to a user. The full SoundFont and the fanfares are public.
package media

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/andrewloable/kantahe/server/internal/assets"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// Lifetimes of signed URLs.
const (
	URLLifetime = 6 * time.Hour // what GetPlayback issues
	MaxLifetime = 7 * time.Hour // the furthest expiry Verify accepts
)

const secretName = "media"

// Config holds the dependencies of a Service.
type Config struct {
	DB        *store.DB
	SoundFont string // path of the full SoundFont, "" for none
	DataDir   string // <data>: per-song SoundFonts are cached under cache/sf2
	Now       func() time.Time
	Logger    *slog.Logger
}

// Service signs and serves media.
type Service struct {
	db     *store.DB
	secret []byte
	now    func() time.Time
	logger *slog.Logger

	soundFont string
	sfETag    string
	fonts     *SoundFonts // nil without a full SoundFont
	renderer  Renderer    // nil without one; set once at start-up, before the routes serve
}

// Renderer turns MIDI songs into audio on the server (package render). Its errors are
// library.ErrNotFound, ErrNotReady and ErrBuildFailed.
type Renderer interface {
	Available() bool
	Ready(ctx context.Context, number string) bool
	Failed(ctx context.Context, number string) bool
	Path(ctx context.Context, number string) (string, error)
	Prepare(number string)
	Touch(path string)
}

// New prepares the service. A configured SoundFont that cannot be read is an error.
func New(ctx context.Context, c Config) (*Service, error) {
	s := &Service{db: c.DB, now: c.Now, logger: c.Logger, soundFont: c.SoundFont}
	if s.now == nil {
		s.now = time.Now
	}
	if c.SoundFont != "" {
		tag, err := fileTag(c.SoundFont)
		if err != nil {
			return nil, fmt.Errorf("read the SoundFont: %w", err)
		}
		s.sfETag = tag
		fonts, err := NewSoundFonts(c.DB, c.DataDir, c.SoundFont, strings.Trim(tag, `"`), c.Logger, s.now)
		if err != nil {
			return nil, err
		}
		s.fonts = fonts
	}
	secret, err := c.DB.Secret(ctx, secretName, 32)
	if err != nil {
		return nil, fmt.Errorf("media secret: %w", err)
	}
	s.secret = secret
	return s, nil
}

// fileTag is the quoted first 16 hex digits of the file's SHA-256.
func fileTag(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return `"` + hex.EncodeToString(h.Sum(nil))[:16] + `"`, nil
}

// Run builds per-song SoundFonts in the background until ctx is cancelled.
func (s *Service) Run(ctx context.Context) {
	if s.fonts != nil {
		s.fonts.Run(ctx)
	}
}

// Close releases the SoundFont file.
func (s *Service) Close() error {
	if s.fonts != nil {
		return s.fonts.Close()
	}
	return nil
}

// Fonts returns the per-song SoundFont cache, nil when no SoundFont is configured.
func (s *Service) Fonts() *SoundFonts { return s.fonts }

// SetRenderer installs the renderer behind /media/rendered. Call it before serving.
func (s *Service) SetRenderer(r Renderer) { s.renderer = r }

// Renderer returns the renderer, nil when the server has none.
func (s *Service) Renderer() Renderer { return s.renderer }

// HasSoundFont reports whether a full SoundFont is configured.
func (s *Service) HasSoundFont() bool { return s.soundFont != "" }

func (s *Service) mac(path, userID, exp string) []byte {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(path + "\n" + userID + "\n" + exp))
	return m.Sum(nil)
}

// Sign returns path with the query that authorises userID to fetch it until exp.
func (s *Service) Sign(path, userID string, exp time.Time) string {
	e := strconv.FormatInt(exp.Unix(), 10)
	sig := base64.RawURLEncoding.EncodeToString(s.mac(path, userID, e))
	return path + "?u=" + url.QueryEscape(userID) + "&exp=" + e + "&sig=" + sig
}

// Verify checks the signature, the expiry (in the future, at most 7 hours ahead)
// and that the user still exists and is enabled. It returns the user.
func (s *Service) Verify(r *http.Request) (string, bool) {
	q := r.URL.Query()
	userID, exp, sig := q.Get("u"), q.Get("exp"), q.Get("sig")
	// the signed text is joined with newlines: forbid them in the fields
	if userID == "" || exp == "" || sig == "" || strings.ContainsAny(userID+r.URL.Path, "\n") {
		return "", false
	}
	got, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil || subtle.ConstantTimeCompare(got, s.mac(r.URL.Path, userID, exp)) != 1 {
		return "", false
	}
	unix, err := strconv.ParseInt(exp, 10, 64)
	if err != nil {
		return "", false
	}
	until := time.Unix(unix, 0).Sub(s.now())
	if until <= 0 || until > MaxLifetime {
		return "", false
	}
	var disabled int
	err = s.db.QueryRowContext(r.Context(), `SELECT disabled FROM users WHERE id = ?`, userID).Scan(&disabled)
	if err != nil || disabled != 0 {
		return "", false
	}
	return userID, true
}

// Routes registers the media routes.
func (s *Service) Routes(handle func(pattern string, h http.Handler)) {
	handle("GET /media/song/{number}", http.HandlerFunc(s.song))
	handle("GET /media/soundfont.sf2", http.HandlerFunc(s.fullSoundFont))
	handle("GET /media/soundfont/{file}", http.HandlerFunc(s.songSoundFont))
	handle("GET /media/rendered/{number}", http.HandlerFunc(s.rendered))
	handle("GET /media/fanfare/{name}", http.HandlerFunc(s.fanfare))
}

func (s *Service) song(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.Verify(r); !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	number, ok := library.CanonicalNumber(r.PathValue("number"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	var format int
	var path, mediaPath string
	err := s.db.QueryRowContext(r.Context(), `SELECT format, path, media_path FROM songs WHERE number = ? AND deleted = 0 AND failed = 0 AND metadata_done = 1`, number).
		Scan(&format, &path, &mediaPath)
	if errors.Is(err, sql.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		s.logger.Error("media lookup failed", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	file, contentType := mediaPath, "audio/mpeg"
	if library.Format(format) == library.FormatMIDI {
		file, contentType = path, "audio/midi"
	}
	if file == "" {
		http.NotFound(w, r)
		return
	}
	s.serveFile(w, r, file, contentType, "private, max-age=3600")
}

func (s *Service) serveFile(w http.ResponseWriter, r *http.Request, file, contentType, cacheControl string) {
	f, err := os.Open(file)
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
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", cacheControl)
	http.ServeContent(w, r, "", st.ModTime(), f)
}

func (s *Service) fullSoundFont(w http.ResponseWriter, r *http.Request) {
	if s.soundFont == "" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("ETag", s.sfETag)
	s.serveFile(w, r, s.soundFont, "application/octet-stream", "public, max-age=86400")
}

func (s *Service) fanfare(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if len(name) != len("1.mp3") || name[1:] != ".mp3" || name[0] < '1' || name[0] > '3' {
		http.NotFound(w, r)
		return
	}
	data, ok := assets.Fanfare(int(name[0] - '0'))
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(data))
}

// songSoundFont serves the trimmed SoundFont of one MIDI song. While it is being
// built the answer is 503 with Retry-After.
func (s *Service) songSoundFont(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.Verify(r); !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	number, ok := strings.CutSuffix(r.PathValue("file"), ".sf2")
	if !ok || s.fonts == nil {
		http.NotFound(w, r)
		return
	}
	path, err := s.fonts.Path(r.Context(), number)
	switch {
	case errors.Is(err, library.ErrNotFound):
		http.NotFound(w, r)
	case errors.Is(err, ErrNotReady):
		s.fonts.Prepare(number)
		w.Header().Set("Retry-After", "1")
		http.Error(w, "the SoundFont is being prepared", http.StatusServiceUnavailable)
	case err != nil:
		s.logger.Error("per-song SoundFont unavailable", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	default:
		s.fonts.Touch(path)
		s.serveFile(w, r, path, "application/octet-stream", "private, max-age=86400")
	}
}

// rendered serves the server-rendered audio of one MIDI song (Range supported). While it is
// being rendered the answer is 503 with Retry-After, and the render is started if it is not.
func (s *Service) rendered(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.Verify(r); !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	rd := s.renderer
	if rd == nil || !rd.Available() {
		http.NotFound(w, r)
		return
	}
	number := r.PathValue("number")
	path, err := rd.Path(r.Context(), number)
	switch {
	case errors.Is(err, library.ErrNotFound):
		http.NotFound(w, r)
	case errors.Is(err, ErrNotReady):
		rd.Prepare(number)
		w.Header().Set("Retry-After", "2")
		http.Error(w, "the song is being rendered", http.StatusServiceUnavailable)
	case err != nil:
		s.logger.Error("rendered audio unavailable", "song", number, "err", err)
		http.Error(w, "the song could not be rendered", http.StatusInternalServerError)
	default:
		// The cache may have evicted the file since Path found it: render again instead of reporting 404.
		if _, err := os.Stat(path); err != nil {
			rd.Prepare(number)
			w.Header().Set("Retry-After", "2")
			http.Error(w, "the song is being rendered", http.StatusServiceUnavailable)
			return
		}
		rd.Touch(path)
		s.serveFile(w, r, path, "audio/flac", "private, max-age=3600")
	}
}
