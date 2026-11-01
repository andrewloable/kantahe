//
//  Generated code. Do not modify.
//  source: kantahe/v1/upload.proto
//

import "package:connectrpc/connect.dart" as connect;
import "upload.pb.dart" as kantahev1upload;
import "upload.connect.spec.dart" as specs;

/// Song upload; requires the uploader role (PERMISSION_DENIED otherwise).
extension type UploadServiceClient (connect.Transport _transport) {
  /// Uploader or admin. One .kar or .karmp3 per call (ZIPs are unpacked on the client); rejections are reported in the response, not as errors.
  Future<kantahev1upload.UploadSongResponse> uploadSong(
    kantahev1upload.UploadSongRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UploadService.uploadSong,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Starts, or resumes, the upload of one background video: a video is too big for one message, so it goes up in chunks of
  /// unary calls (D3). REJECTED with a reason when the name, the size or the limit is refused; received > 0 when an earlier upload of the same file by the same admin is resumed.
  Future<kantahev1upload.BeginVideoUploadResponse> beginVideoUpload(
    kantahev1upload.BeginVideoUploadRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UploadService.beginVideoUpload,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. One chunk of at most 4 MiB at the offset the server expects next (INVALID_ARGUMENT otherwise); returns the bytes received so far.
  Future<kantahev1upload.UploadVideoChunkResponse> uploadVideoChunk(
    kantahev1upload.UploadVideoChunkRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UploadService.uploadVideoChunk,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Checks the whole file (an MP4 with an H.264 video track) and adds it to the end of the loop; rejections are reported in the response, not as errors.
  Future<kantahev1upload.CompleteVideoUploadResponse> completeVideoUpload(
    kantahev1upload.CompleteVideoUploadRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UploadService.completeVideoUpload,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Throws away what was received of an unfinished upload.
  Future<kantahev1upload.AbortVideoUploadResponse> abortVideoUpload(
    kantahev1upload.AbortVideoUploadRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UploadService.abortVideoUpload,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }
}
