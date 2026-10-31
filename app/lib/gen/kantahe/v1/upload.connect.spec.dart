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
}
