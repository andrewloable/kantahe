package api

import (
	"context"
	"errors"
	"log/slog"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/catalog"
	"github.com/andrewloable/kantahe/server/internal/userlib"
)

// UserLibraryServer implements favourites, history and playlists of the caller.
type UserLibraryServer struct {
	kantahev1connect.UnimplementedUserLibraryServiceHandler
	d Deps
}

func newUserLibraryServer(d Deps) *UserLibraryServer { return &UserLibraryServer{d: d} }

// userLibErr maps the library's errors to connect codes in one place.
func userLibErr(logger *slog.Logger, op string, err error) error {
	switch {
	case errors.Is(err, userlib.ErrInvalid):
		return newErr(connect.CodeInvalidArgument, err.Error())
	case errors.Is(err, userlib.ErrNotFound):
		return newErr(connect.CodeNotFound, "not found")
	case errors.Is(err, catalog.ErrInvalid):
		return newErr(connect.CodeInvalidArgument, err.Error())
	}
	return internalErr(logger, op, err)
}

// SetFavourite adds or removes a favourite.
func (s *UserLibraryServer) SetFavourite(ctx context.Context, req *connect.Request[kantahev1.SetFavouriteRequest]) (*connect.Response[kantahev1.SetFavouriteResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.d.UserLib.SetFavourite(ctx, id.UserID, req.Msg.Number, req.Msg.Favourite); err != nil {
		return nil, userLibErr(s.d.Logger, "SetFavourite", err)
	}
	return connect.NewResponse(&kantahev1.SetFavouriteResponse{}), nil
}

// ListFavourites lists the caller's favourites, newest first.
func (s *UserLibraryServer) ListFavourites(ctx context.Context, req *connect.Request[kantahev1.ListFavouritesRequest]) (*connect.Response[kantahev1.ListFavouritesResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	offset, err := catalog.DecodePageToken(req.Msg.PageToken)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "ListFavourites", err)
	}
	limit := catalog.ClampPageSize(int(req.Msg.PageSize))
	list, more, err := s.d.UserLib.ListFavourites(ctx, id.UserID, offset, limit)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "ListFavourites", err)
	}
	out := &kantahev1.ListFavouritesResponse{}
	for _, song := range list {
		out.Songs = append(out.Songs, toProtoSong(song, true))
	}
	if more {
		out.NextPageToken = catalog.EncodePageToken(offset + len(list))
	}
	return connect.NewResponse(out), nil
}

// ListHistory lists the songs the caller sang or skipped, newest first.
func (s *UserLibraryServer) ListHistory(ctx context.Context, req *connect.Request[kantahev1.ListHistoryRequest]) (*connect.Response[kantahev1.ListHistoryResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	offset, err := catalog.DecodePageToken(req.Msg.PageToken)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "ListHistory", err)
	}
	limit := catalog.ClampPageSize(int(req.Msg.PageSize))
	list, more, err := s.d.UserLib.ListHistory(ctx, id.UserID, offset, limit)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "ListHistory", err)
	}
	out := &kantahev1.ListHistoryResponse{}
	var songs []*kantahev1.Song
	for _, h := range list {
		song := toProtoSong(h.Song, false)
		songs = append(songs, song)
		out.Entries = append(out.Entries, &kantahev1.HistoryEntry{Song: song, SungAtUnix: h.SungAt, Skipped: h.Skipped, HasScore: h.HasScore, Score: int32(h.Score)})
	}
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, songs...); err != nil {
		return nil, userLibErr(s.d.Logger, "ListHistory", err)
	}
	if more {
		out.NextPageToken = catalog.EncodePageToken(offset + len(list))
	}
	return connect.NewResponse(out), nil
}

func (s *UserLibraryServer) playlist(ctx context.Context, userID string, p userlib.Playlist) (*kantahev1.Playlist, error) {
	out := &kantahev1.Playlist{Id: p.ID, Name: p.Name}
	for _, song := range p.Songs {
		out.Songs = append(out.Songs, toProtoSong(song, false))
	}
	return out, markFavourites(ctx, s.d.UserLib, userID, out.Songs...)
}

// ListPlaylists lists the caller's playlists.
func (s *UserLibraryServer) ListPlaylists(ctx context.Context, _ *connect.Request[kantahev1.ListPlaylistsRequest]) (*connect.Response[kantahev1.ListPlaylistsResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	list, err := s.d.UserLib.ListPlaylists(ctx, id.UserID)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "ListPlaylists", err)
	}
	out := &kantahev1.ListPlaylistsResponse{}
	for _, p := range list {
		out.Playlists = append(out.Playlists, &kantahev1.PlaylistSummary{Id: p.ID, Name: p.Name, SongCount: int32(p.Count)})
	}
	return connect.NewResponse(out), nil
}

// GetPlaylist returns one of the caller's playlists.
func (s *UserLibraryServer) GetPlaylist(ctx context.Context, req *connect.Request[kantahev1.GetPlaylistRequest]) (*connect.Response[kantahev1.GetPlaylistResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	p, err := s.d.UserLib.GetPlaylist(ctx, id.UserID, req.Msg.Id)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "GetPlaylist", err)
	}
	pp, err := s.playlist(ctx, id.UserID, p)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "GetPlaylist", err)
	}
	return connect.NewResponse(&kantahev1.GetPlaylistResponse{Playlist: pp}), nil
}

// CreatePlaylist makes a playlist from song numbers.
func (s *UserLibraryServer) CreatePlaylist(ctx context.Context, req *connect.Request[kantahev1.CreatePlaylistRequest]) (*connect.Response[kantahev1.CreatePlaylistResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	p, err := s.d.UserLib.CreatePlaylist(ctx, id.UserID, req.Msg.Name, req.Msg.Numbers)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "CreatePlaylist", err)
	}
	pp, err := s.playlist(ctx, id.UserID, p)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "CreatePlaylist", err)
	}
	return connect.NewResponse(&kantahev1.CreatePlaylistResponse{Playlist: pp}), nil
}

// UpdatePlaylist renames and/or replaces or appends songs.
func (s *UserLibraryServer) UpdatePlaylist(ctx context.Context, req *connect.Request[kantahev1.UpdatePlaylistRequest]) (*connect.Response[kantahev1.UpdatePlaylistResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	p, err := s.d.UserLib.UpdatePlaylist(ctx, id.UserID, m.Id, m.Name, m.ReplaceNumbers, m.Numbers)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "UpdatePlaylist", err)
	}
	pp, err := s.playlist(ctx, id.UserID, p)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "UpdatePlaylist", err)
	}
	return connect.NewResponse(&kantahev1.UpdatePlaylistResponse{Playlist: pp}), nil
}

// DeletePlaylist removes one of the caller's playlists.
func (s *UserLibraryServer) DeletePlaylist(ctx context.Context, req *connect.Request[kantahev1.DeletePlaylistRequest]) (*connect.Response[kantahev1.DeletePlaylistResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.d.UserLib.DeletePlaylist(ctx, id.UserID, req.Msg.Id); err != nil {
		return nil, userLibErr(s.d.Logger, "DeletePlaylist", err)
	}
	return connect.NewResponse(&kantahev1.DeletePlaylistResponse{}), nil
}
