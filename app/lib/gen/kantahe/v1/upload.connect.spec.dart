//
//  Generated code. Do not modify.
//  source: kantahe/v1/upload.proto
//

import "package:connectrpc/connect.dart" as connect;
import "upload.pb.dart" as kantahev1upload;

/// Song upload; requires the uploader role (PERMISSION_DENIED otherwise).
abstract final class UploadService {
  /// Fully-qualified name of the UploadService service.
  static const name = 'kantahe.v1.UploadService';

  /// Uploader or admin. One .kar or .karmp3 per call (ZIPs are unpacked on the client); rejections are reported in the response, not as errors.
  static const uploadSong = connect.Spec(
    '/$name/UploadSong',
    connect.StreamType.unary,
    kantahev1upload.UploadSongRequest.new,
    kantahev1upload.UploadSongResponse.new,
  );

  /// Admin only. Starts, or resumes, the upload of one background video: a video is too big for one message, so it goes up in chunks of
  /// unary calls (D3). REJECTED with a reason when the name, the size or the limit is refused; received > 0 when an earlier upload of the same file by the same admin is resumed.
  static const beginVideoUpload = connect.Spec(
    '/$name/BeginVideoUpload',
    connect.StreamType.unary,
    kantahev1upload.BeginVideoUploadRequest.new,
    kantahev1upload.BeginVideoUploadResponse.new,
  );

  /// Admin only. One chunk of at most 4 MiB at the offset the server expects next (INVALID_ARGUMENT otherwise); returns the bytes received so far.
  static const uploadVideoChunk = connect.Spec(
    '/$name/UploadVideoChunk',
    connect.StreamType.unary,
    kantahev1upload.UploadVideoChunkRequest.new,
    kantahev1upload.UploadVideoChunkResponse.new,
  );

  /// Admin only. Checks the whole file (an MP4 with an H.264 video track) and adds it to the end of the loop; rejections are reported in the response, not as errors.
  static const completeVideoUpload = connect.Spec(
    '/$name/CompleteVideoUpload',
    connect.StreamType.unary,
    kantahev1upload.CompleteVideoUploadRequest.new,
    kantahev1upload.CompleteVideoUploadResponse.new,
  );

  /// Admin only. Throws away what was received of an unfinished upload.
  static const abortVideoUpload = connect.Spec(
    '/$name/AbortVideoUpload',
    connect.StreamType.unary,
    kantahev1upload.AbortVideoUploadRequest.new,
    kantahev1upload.AbortVideoUploadResponse.new,
  );
}
