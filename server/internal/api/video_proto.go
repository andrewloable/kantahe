package api

import (
	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// toProtoVideo is the wire form of a video with its advice texts. url is the signed URL the caller wants the client to use, "" for none.
func toProtoVideo(v video.Video, url string) *kantahev1.Video {
	return &kantahev1.Video{
		Id: v.ID, Name: v.Name, SizeBytes: v.Size, DurationMs: v.DurationMs, Width: int32(v.Width), Height: int32(v.Height), Codec: v.Codec,
		HasAudio: v.HasAudio, Faststart: v.FastStart, Enabled: v.Enabled, Position: int32(v.Position), CreatedAtUnix: v.CreatedAt,
		Url: url, Warnings: video.Warnings(v),
	}
}
