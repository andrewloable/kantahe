package api

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/catalog"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/settings"
)

const maxEditLen = 200

func songNumber(raw string) (string, error) {
	n, ok := library.CanonicalNumber(strings.TrimSpace(raw))
	if !ok {
		return "", invalidArgument("a song number is made of digits")
	}
	return n, nil
}

func validEdit(what string, v *string) error {
	if v != nil && utf8.RuneCountInString(strings.TrimSpace(*v)) > maxEditLen {
		return invalidArgument(what + " is too long")
	}
	return nil
}

func (s *AdminServer) songErr(op string, err error) error {
	switch {
	case errors.Is(err, library.ErrNotFound):
		return newErr(connect.CodeNotFound, "song not found")
	case errors.Is(err, library.ErrOutsideManaged):
		return newErr(connect.CodeFailedPrecondition, err.Error())
	}
	var rm *library.RemoveError
	if errors.As(err, &rm) {
		return newErr(connect.CodeFailedPrecondition, "the song's file could not be deleted: "+rm.Error())
	}
	return internalErr(s.d.Logger, op, err)
}

// UpdateSong sets or clears the admin's title and artist for a song.
func (s *AdminServer) UpdateSong(ctx context.Context, req *connect.Request[kantahev1.UpdateSongRequest]) (*connect.Response[kantahev1.UpdateSongResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	number, err := songNumber(m.Number)
	if err != nil {
		return nil, err
	}
	if err := validEdit("title", m.Title); err != nil {
		return nil, err
	}
	if err := validEdit("artist", m.Artist); err != nil {
		return nil, err
	}
	if err := s.d.Importer.SetEdit(ctx, number, m.Title, m.Artist); err != nil {
		return nil, s.songErr("UpdateSong", err)
	}
	info, err := library.GetSong(ctx, s.d.DB, number)
	if err != nil {
		return nil, s.songErr("UpdateSong", err)
	}
	song := toProtoSong(info, false)
	if err := markFavourites(ctx, s.d.UserLib, caller.UserID, song); err != nil {
		return nil, internalErr(s.d.Logger, "UpdateSong", err)
	}
	return connect.NewResponse(&kantahev1.UpdateSongResponse{Song: song}), nil
}

// DeleteSong removes a song and, unless keep_file is set, its file.
func (s *AdminServer) DeleteSong(ctx context.Context, req *connect.Request[kantahev1.DeleteSongRequest]) (*connect.Response[kantahev1.DeleteSongResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	number, err := songNumber(req.Msg.Number)
	if err != nil {
		return nil, err
	}
	remove := s.d.Importer.DeleteSong
	if req.Msg.KeepFile {
		remove = s.d.Importer.RemoveFromList
	}
	if err := remove(ctx, number); err != nil {
		return nil, s.songErr("DeleteSong", err)
	}
	return connect.NewResponse(&kantahev1.DeleteSongResponse{}), nil
}

// RemoveSongs takes many songs off the list. Their files are never deleted, except with scope BROKEN and delete_files.
func (s *AdminServer) RemoveSongs(ctx context.Context, req *connect.Request[kantahev1.RemoveSongsRequest]) (*connect.Response[kantahev1.RemoveSongsResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	var scope library.RemoveScope
	switch req.Msg.Scope {
	case kantahev1.RemoveScope_REMOVE_SCOPE_ALL:
		scope = library.ScopeAll
	case kantahev1.RemoveScope_REMOVE_SCOPE_NO_MUSIC:
		scope = library.ScopeNoMusic
	case kantahev1.RemoveScope_REMOVE_SCOPE_BROKEN:
		scope = library.ScopeBroken
	default:
		return nil, invalidArgument("choose which songs to remove")
	}
	if req.Msg.DeleteFiles && scope != library.ScopeBroken {
		return nil, invalidArgument("files are deleted only when removing the broken songs")
	}
	res, err := s.d.Importer.RemoveSongsFiles(ctx, scope, req.Msg.DeleteFiles)
	if err != nil {
		return nil, internalErr(s.d.Logger, "RemoveSongs", err)
	}
	return connect.NewResponse(&kantahev1.RemoveSongsResponse{Removed: int32(res.Removed), FilesDeleted: int32(res.FilesDeleted), FilesFailed: int32(res.FilesFailed)}), nil
}

// CheckLibrary re-judges every song and streams its progress; the last message has done = true. One check at a time.
func (s *AdminServer) CheckLibrary(ctx context.Context, _ *connect.Request[kantahev1.CheckLibraryRequest], stream *connect.ServerStream[kantahev1.CheckLibraryResponse]) error {
	if _, err := requireAdmin(ctx); err != nil {
		return err
	}
	if !s.checking.CompareAndSwap(false, true) {
		return newErr(connect.CodeFailedPrecondition, "a check is already running")
	}
	defer s.checking.Store(false)
	var sendErr error
	var total int
	broken, err := s.d.Importer.CheckLibrary(ctx, func(checked, all, found int) {
		total = all
		if sendErr == nil {
			sendErr = stream.Send(&kantahev1.CheckLibraryResponse{Checked: int32(checked), Total: int32(all), Broken: int32(found)})
		}
	})
	if err != nil {
		if ctx.Err() != nil {
			return nil // the client went away; nobody is left to tell
		}
		return internalErr(s.d.Logger, "CheckLibrary", err)
	}
	if sendErr != nil {
		return nil
	}
	return stream.Send(&kantahev1.CheckLibraryResponse{Checked: int32(total), Total: int32(total), Broken: int32(broken), Done: true})
}

// ListBrokenSongs returns a page of the songs marked broken, with the reason.
func (s *AdminServer) ListBrokenSongs(ctx context.Context, req *connect.Request[kantahev1.ListBrokenSongsRequest]) (*connect.Response[kantahev1.ListBrokenSongsResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	offset, err := catalog.DecodePageToken(req.Msg.PageToken)
	if err != nil {
		return nil, invalidArgument("the page token is not valid")
	}
	limit := int(req.Msg.PageSize)
	if limit <= 0 {
		limit = 50
	}
	limit = min(limit, 200)
	songs, total, err := library.ListBroken(ctx, s.d.DB, offset, limit)
	if err != nil {
		return nil, internalErr(s.d.Logger, "ListBrokenSongs", err)
	}
	res := &kantahev1.ListBrokenSongsResponse{Total: int32(total)}
	for _, b := range songs {
		res.Songs = append(res.Songs, &kantahev1.BrokenSong{Song: toProtoSong(b.SongInfo, false), Reason: b.Reason})
	}
	if offset+len(songs) < total {
		res.NextPageToken = catalog.EncodePageToken(offset + len(songs))
	}
	return connect.NewResponse(res), nil
}

// Rescan scans the watched folders now and reports the counts.
func (s *AdminServer) Rescan(ctx context.Context, _ *connect.Request[kantahev1.RescanRequest]) (*connect.Response[kantahev1.RescanResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	before, err := s.d.Importer.FailedCount(ctx)
	if err != nil {
		return nil, internalErr(s.d.Logger, "Rescan", err)
	}
	res, err := s.d.Importer.Scan(ctx)
	if err != nil {
		return nil, internalErr(s.d.Logger, "Rescan", err)
	}
	after, err := s.d.Importer.FailedCount(ctx)
	if err != nil {
		return nil, internalErr(s.d.Logger, "Rescan", err)
	}
	return connect.NewResponse(&kantahev1.RescanResponse{
		Added: int32(res.Added), Updated: int32(res.Updated), Removed: int32(res.Removed),
		Failed: int32(res.Failed + max(0, after-before)),
	}), nil
}

func (s *AdminServer) loadSettings(ctx context.Context) (*kantahev1.ServerSettings, error) {
	cur, err := settings.Load(ctx, s.d.DB, s.d.ScoreSeconds)
	if err != nil {
		return nil, err
	}
	return &kantahev1.ServerSettings{MaxUploadBytes: cur.MaxUploadBytes, ScoreSeconds: int32(cur.ScoreSeconds), MaxVideoBytes: cur.MaxVideoBytes,
		BackgroundEnabled: cur.BackgroundEnabled, BackgroundShuffle: cur.BackgroundShuffle}, nil
}

// GetServerSettings returns the current settings.
func (s *AdminServer) GetServerSettings(ctx context.Context, _ *connect.Request[kantahev1.GetServerSettingsRequest]) (*connect.Response[kantahev1.GetServerSettingsResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	cur, err := s.loadSettings(ctx)
	if err != nil {
		return nil, internalErr(s.d.Logger, "GetServerSettings", err)
	}
	return connect.NewResponse(&kantahev1.GetServerSettingsResponse{Settings: cur}), nil
}

// UpdateServerSettings changes only the settings that are set.
func (s *AdminServer) UpdateServerSettings(ctx context.Context, req *connect.Request[kantahev1.UpdateServerSettingsRequest]) (*connect.Response[kantahev1.UpdateServerSettingsResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	m := req.Msg
	var seconds *int
	if m.ScoreSeconds != nil {
		v := int(m.GetScoreSeconds())
		seconds = &v
	}
	err := s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		return settings.Update(ctx, tx, settings.Patch{MaxUploadBytes: m.MaxUploadBytes, ScoreSeconds: seconds, MaxVideoBytes: m.MaxVideoBytes,
			BackgroundEnabled: m.BackgroundEnabled, BackgroundShuffle: m.BackgroundShuffle})
	})
	if errors.Is(err, settings.ErrInvalid) {
		return nil, invalidArgument(err.Error())
	}
	if err != nil {
		return nil, internalErr(s.d.Logger, "UpdateServerSettings", err)
	}
	cur, err := s.loadSettings(ctx)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UpdateServerSettings", err)
	}
	return connect.NewResponse(&kantahev1.UpdateServerSettingsResponse{Settings: cur}), nil
}
