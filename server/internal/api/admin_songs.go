package api

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
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

// DeleteSong removes a song and its file.
func (s *AdminServer) DeleteSong(ctx context.Context, req *connect.Request[kantahev1.DeleteSongRequest]) (*connect.Response[kantahev1.DeleteSongResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	number, err := songNumber(req.Msg.Number)
	if err != nil {
		return nil, err
	}
	if err := s.d.Importer.DeleteSong(ctx, number); err != nil {
		return nil, s.songErr("DeleteSong", err)
	}
	return connect.NewResponse(&kantahev1.DeleteSongResponse{}), nil
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
	return &kantahev1.ServerSettings{MaxUploadBytes: cur.MaxUploadBytes, ScoreSeconds: int32(cur.ScoreSeconds)}, nil
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
		return settings.Update(ctx, tx, m.MaxUploadBytes, seconds)
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
