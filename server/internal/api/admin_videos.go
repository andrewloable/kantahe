package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// The management of the background videos (docs/PLAN.md section 4.2). The AdminService handler has the adminOnly interceptor, and each
// method asks for the role again, like the others.

// videoMessages turns videos into wire messages with the preview URL of the caller (one hour).
func (s *AdminServer) videoMessages(vs []video.Video, userID string) []*kantahev1.Video {
	now := s.d.Now()
	out := make([]*kantahev1.Video, 0, len(vs))
	for _, v := range vs {
		out = append(out, toProtoVideo(v, s.media.PreviewURL(v.ID, userID, now)))
	}
	return out
}

func (s *AdminServer) videoErr(op string, err error) error {
	var rm *video.RemoveError
	switch {
	case errors.Is(err, video.ErrNotFound):
		return newErr(connect.CodeNotFound, "video not found")
	case errors.Is(err, video.ErrInvalidName):
		return invalidArgument("the name must be 1 to 200 characters")
	case errors.Is(err, video.ErrNotPermutation):
		return invalidArgument("the list does not match the videos on the server: reload")
	case errors.As(err, &rm):
		if fsutil.IsBusy(rm.Err) {
			return newErr(connect.CodeFailedPrecondition, "the video's file could not be deleted: it is in use (a player or a virus scanner may have it open); try again in a moment")
		}
		return newErr(connect.CodeFailedPrecondition, "the video's file could not be deleted: "+rm.Error())
	}
	return internalErr(s.d.Logger, op, err)
}

// ListVideos returns every background video in loop order, each with a preview URL.
func (s *AdminServer) ListVideos(ctx context.Context, _ *connect.Request[kantahev1.ListVideosRequest]) (*connect.Response[kantahev1.ListVideosResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	list, err := video.New(s.d.DB).List(ctx)
	if err != nil {
		return nil, s.videoErr("ListVideos", err)
	}
	return connect.NewResponse(&kantahev1.ListVideosResponse{Videos: s.videoMessages(list, caller.UserID)}), nil
}

// UpdateVideo renames a video and/or switches it on or off; a field that is not set stays as it is.
func (s *AdminServer) UpdateVideo(ctx context.Context, req *connect.Request[kantahev1.UpdateVideoRequest]) (*connect.Response[kantahev1.UpdateVideoResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	v, err := video.New(s.d.DB).Update(ctx, m.Id, m.Name, m.Enabled)
	if err != nil {
		return nil, s.videoErr("UpdateVideo", err)
	}
	return connect.NewResponse(&kantahev1.UpdateVideoResponse{Video: s.videoMessages([]video.Video{v}, caller.UserID)[0]}), nil
}

// ReorderVideos sets the loop order; ids must be all the videos there are, each once.
func (s *AdminServer) ReorderVideos(ctx context.Context, req *connect.Request[kantahev1.ReorderVideosRequest]) (*connect.Response[kantahev1.ReorderVideosResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	list, err := video.New(s.d.DB).Reorder(ctx, req.Msg.Ids)
	if err != nil {
		return nil, s.videoErr("ReorderVideos", err)
	}
	return connect.NewResponse(&kantahev1.ReorderVideosResponse{Videos: s.videoMessages(list, caller.UserID)}), nil
}

// DeleteVideo removes a video and its file. The file goes before the change is committed: when it cannot be deleted the video stays.
func (s *AdminServer) DeleteVideo(ctx context.Context, req *connect.Request[kantahev1.DeleteVideoRequest]) (*connect.Response[kantahev1.DeleteVideoResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	video.FilesMu.Lock() // not between the two steps of an upload of the same content
	defer video.FilesMu.Unlock()
	err := video.New(s.d.DB).DeleteWithFile(ctx, req.Msg.Id, func(sha string) error {
		p := video.Path(s.d.DataDir, sha)
		if p == "" {
			return nil // the row did not name a file of ours: nothing to delete
		}
		// a file in use on Windows is waited for, but under store.BusyTimeout: this transaction holds the write lock
		return fsutil.Remove(ctx, p, fsutil.DeleteBudget)
	})
	if err != nil {
		return nil, s.videoErr("DeleteVideo", err)
	}
	return connect.NewResponse(&kantahev1.DeleteVideoResponse{}), nil
}
