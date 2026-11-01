package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/catalog"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/media"
	"github.com/andrewloable/kantahe/server/internal/settings"
	"github.com/andrewloable/kantahe/server/internal/users"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// CatalogServer implements CatalogService.
type CatalogServer struct {
	kantahev1connect.UnimplementedCatalogServiceHandler
	d     Deps
	cat   *catalog.Catalog
	media *media.Service
}

func newCatalogServer(d Deps, cat *catalog.Catalog, m *media.Service) *CatalogServer {
	return &CatalogServer{d: d, cat: cat, media: m}
}

// fromCatalog maps catalog and library errors to connect codes in one place.
func fromCatalog(logger interface {
	Error(msg string, args ...any)
}, op string, err error) error {
	switch {
	case errors.Is(err, catalog.ErrInvalid):
		return newErr(connect.CodeInvalidArgument, err.Error())
	case errors.Is(err, library.ErrNotFound):
		return newErr(connect.CodeNotFound, "song not found")
	case errors.Is(err, catalog.ErrNoLyrics):
		return newErr(connect.CodeNotFound, "the song has no lyrics")
	}
	logger.Error("request failed", "op", op, "err", err)
	return newErr(connect.CodeInternal, "internal error")
}

func songSort(s kantahev1.SongSort) (catalog.Sort, error) {
	switch s {
	case kantahev1.SongSort_SONG_SORT_UNSPECIFIED:
		return catalog.SortRelevance, nil
	case kantahev1.SongSort_SONG_SORT_NUMBER:
		return catalog.SortNumber, nil
	case kantahev1.SongSort_SONG_SORT_TITLE:
		return catalog.SortTitle, nil
	case kantahev1.SongSort_SONG_SORT_ARTIST:
		return catalog.SortArtist, nil
	}
	return 0, invalidArgument("unknown sort")
}

// SearchSongs searches by number prefix or text, or browses by letter.
func (s *CatalogServer) SearchSongs(ctx context.Context, req *connect.Request[kantahev1.SearchSongsRequest]) (*connect.Response[kantahev1.SearchSongsResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	sort, err := songSort(m.Sort)
	if err != nil {
		return nil, err
	}
	switch m.Format {
	case kantahev1.Format_FORMAT_UNSPECIFIED, kantahev1.Format_FORMAT_MP3, kantahev1.Format_FORMAT_MIDI:
	default:
		return nil, invalidArgument("unknown format")
	}
	songs, next, err := s.cat.SearchPage(ctx, catalog.SearchParams{
		Query: m.Query, Format: library.Format(m.Format), Sort: sort, Letter: m.Letter,
	}, m.PageToken, int(m.PageSize))
	if err != nil {
		return nil, fromCatalog(s.d.Logger, "SearchSongs", err)
	}
	out := &kantahev1.SearchSongsResponse{NextPageToken: next}
	for _, song := range songs {
		out.Songs = append(out.Songs, toProtoSong(song, false))
	}
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, out.Songs...); err != nil {
		return nil, internalErr(s.d.Logger, "SearchSongs", err)
	}
	return connect.NewResponse(out), nil
}

// ListArtists lists artists with their song counts.
func (s *CatalogServer) ListArtists(ctx context.Context, req *connect.Request[kantahev1.ListArtistsRequest]) (*connect.Response[kantahev1.ListArtistsResponse], error) {
	m := req.Msg
	artists, next, err := s.cat.ArtistsPage(ctx, m.Letter, m.PageToken, int(m.PageSize))
	if err != nil {
		return nil, fromCatalog(s.d.Logger, "ListArtists", err)
	}
	out := &kantahev1.ListArtistsResponse{NextPageToken: next}
	for _, a := range artists {
		out.Artists = append(out.Artists, &kantahev1.Artist{Name: a.Name, SongCount: int32(a.SongCount)})
	}
	return connect.NewResponse(out), nil
}

// GetSong looks a song up by number; non-canonical digits work.
func (s *CatalogServer) GetSong(ctx context.Context, req *connect.Request[kantahev1.GetSongRequest]) (*connect.Response[kantahev1.GetSongResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	song, err := s.cat.Get(ctx, req.Msg.Number)
	if err != nil {
		return nil, fromCatalog(s.d.Logger, "GetSong", err)
	}
	out := toProtoSong(song, false)
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, out); err != nil {
		return nil, internalErr(s.d.Logger, "GetSong", err)
	}
	return connect.NewResponse(&kantahev1.GetSongResponse{Song: out}), nil
}

// GetLyrics returns the parsed lyrics of a song.
func (s *CatalogServer) GetLyrics(ctx context.Context, req *connect.Request[kantahev1.GetLyricsRequest]) (*connect.Response[kantahev1.GetLyricsResponse], error) {
	l, err := s.cat.Lyrics(ctx, req.Msg.Number)
	if err != nil {
		return nil, fromCatalog(s.d.Logger, "GetLyrics", err)
	}
	return connect.NewResponse(&kantahev1.GetLyricsResponse{Lyrics: l}), nil
}

// GetPlayback describes how the calling device plays a song: signed relative
// URLs (clients prefix their server URL), the lyrics, and for a MIDI song the
// per-song SoundFont, or the server's rendered audio for a device in SERVER mode.
func (s *CatalogServer) GetPlayback(ctx context.Context, req *connect.Request[kantahev1.GetPlaybackRequest]) (*connect.Response[kantahev1.GetPlaybackResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	song, err := s.cat.Get(ctx, req.Msg.Number)
	if err != nil {
		return nil, fromCatalog(s.d.Logger, "GetPlayback", err)
	}
	exp := s.d.Now().Add(media.URLLifetime)
	signed := s.media.Sign("/media/song/"+song.Number, id.UserID, exp)
	pb := &kantahev1.Playback{Song: toProtoSong(song, false), Ready: true}
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, pb.Song); err != nil {
		return nil, internalErr(s.d.Logger, "GetPlayback", err)
	}
	switch song.Format {
	case library.FormatMP3:
		pb.Kind = kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO
		pb.AudioUrl = signed
	default:
		fonts := s.media.Fonts()
		if fonts == nil {
			return nil, newErr(connect.CodeFailedPrecondition, "no SoundFont is configured on this server")
		}
		dev, err := users.DeviceByID(ctx, s.d.DB, id.UserID, id.DeviceID)
		if err != nil {
			return nil, fromUsers(s.d.Logger, "GetPlayback", err)
		}
		mode := s.d.Modes.Effective(kantahev1.MidiMode(dev.MidiMode), kantahev1.DeviceType(dev.Type), dev.MemoryMB, dev.ID)
		// SERVER: the server renders the song and the device plays it like an MP3. When the server
		// cannot (no renderer, or this song failed to render) the device plays the MIDI itself.
		if mode == kantahev1.MidiMode_MIDI_MODE_SERVER {
			switch rd := s.media.Renderer(); {
			case rd == nil || !rd.Available() || rd.Failed(ctx, song.Number):
				mode = kantahev1.MidiMode_MIDI_MODE_LOW_POWER
			default:
				pb.Kind = kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO
				pb.EffectiveMidiMode = mode
				pb.AudioUrl = s.media.Sign("/media/rendered/"+song.Number, id.UserID, exp)
				if !rd.Ready(ctx, song.Number) {
					rd.Prepare(song.Number)
					pb.Ready = false
					pb.RetryAfterMs = 1000
				}
			}
		}
		if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO {
			pb.Kind = kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH
			pb.MidiUrl = signed
			// FULL or LOW_POWER: the client applies its low-power settings in the second case.
			pb.EffectiveMidiMode = mode
			switch {
			case fonts.Failed(ctx, song.Number):
				// the trimmed bank cannot be built: the full bank always works
				pb.SoundfontUrl = "/media/soundfont.sf2"
			case fonts.Ready(ctx, song.Number):
				pb.SoundfontUrl = s.media.Sign("/media/soundfont/"+song.Number+".sf2", id.UserID, exp)
			default:
				fonts.Prepare(song.Number)
				pb.SoundfontUrl = s.media.Sign("/media/soundfont/"+song.Number+".sf2", id.UserID, exp)
				pb.Ready = false
				pb.RetryAfterMs = 500
			}
		}
	}
	switch lyr, err := s.cat.Lyrics(ctx, song.Number); {
	case err == nil:
		pb.Lyrics = lyr
	case errors.Is(err, catalog.ErrNoLyrics):
	default:
		return nil, fromCatalog(s.d.Logger, "GetPlayback", err)
	}
	return connect.NewResponse(&kantahev1.GetPlaybackResponse{Playback: pb}), nil
}

// GetBackground returns the enabled background videos in loop order with signed URLs. The URLs of one video and user stay the same for
// hours (media.VideoURL), so a browser does not fetch a video again at every refresh of the list.
func (s *CatalogServer) GetBackground(ctx context.Context, _ *connect.Request[kantahev1.GetBackgroundRequest]) (*connect.Response[kantahev1.GetBackgroundResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	enabled, err := settings.BackgroundEnabled(ctx, s.d.DB)
	if err != nil {
		return nil, internalErr(s.d.Logger, "GetBackground", err)
	}
	shuffle, err := settings.BackgroundShuffle(ctx, s.d.DB)
	if err != nil {
		return nil, internalErr(s.d.Logger, "GetBackground", err)
	}
	res := &kantahev1.GetBackgroundResponse{Enabled: enabled, Shuffle: shuffle}
	if !enabled {
		return connect.NewResponse(res), nil
	}
	all, err := video.New(s.d.DB).List(ctx)
	if err != nil {
		return nil, internalErr(s.d.Logger, "GetBackground", err)
	}
	now := s.d.Now()
	for _, v := range all {
		if v.Enabled {
			res.Videos = append(res.Videos, toProtoVideo(v, s.media.VideoURL(v.ID, id.UserID, now)))
		}
	}
	return connect.NewResponse(res), nil
}
