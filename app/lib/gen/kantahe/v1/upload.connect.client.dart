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
}
