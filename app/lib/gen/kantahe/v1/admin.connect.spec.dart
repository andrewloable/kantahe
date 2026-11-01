//
//  Generated code. Do not modify.
//  source: kantahe/v1/admin.proto
//

import "package:connectrpc/connect.dart" as connect;
import "admin.pb.dart" as kantahev1admin;

/// Administration; every RPC requires the admin role (PERMISSION_DENIED otherwise).
abstract final class AdminService {
  /// Fully-qualified name of the AdminService service.
  static const name = 'kantahe.v1.AdminService';

  /// Admin only. Lists every user.
  static const listUsers = connect.Spec(
    '/$name/ListUsers',
    connect.StreamType.unary,
    kantahev1admin.ListUsersRequest.new,
    kantahev1admin.ListUsersResponse.new,
  );

  /// Admin only. ALREADY_EXISTS for a duplicate email; the user must change the temporary password.
  static const createUser = connect.Spec(
    '/$name/CreateUser',
    connect.StreamType.unary,
    kantahev1admin.CreateUserRequest.new,
    kantahev1admin.CreateUserResponse.new,
  );

  /// Admin only. Unset optional fields are left unchanged; the last admin cannot be demoted or disabled.
  static const updateUser = connect.Spec(
    '/$name/UpdateUser',
    connect.StreamType.unary,
    kantahev1admin.UpdateUserRequest.new,
    kantahev1admin.UpdateUserResponse.new,
  );

  /// Admin only. Sets a temporary password, must_change_password, and revokes the user's devices.
  static const resetPassword = connect.Spec(
    '/$name/ResetPassword',
    connect.StreamType.unary,
    kantahev1admin.ResetPasswordRequest.new,
    kantahev1admin.ResetPasswordResponse.new,
  );

  /// Admin only. The last admin cannot be deleted.
  static const deleteUser = connect.Spec(
    '/$name/DeleteUser',
    connect.StreamType.unary,
    kantahev1admin.DeleteUserRequest.new,
    kantahev1admin.DeleteUserResponse.new,
  );

  /// Admin only. Signs out every device of the user and returns how many.
  static const revokeUserDevices = connect.Spec(
    '/$name/RevokeUserDevices',
    connect.StreamType.unary,
    kantahev1admin.RevokeUserDevicesRequest.new,
    kantahev1admin.RevokeUserDevicesResponse.new,
  );

  /// Admin only. Title and artist edits survive rescans and always win over file metadata.
  static const updateSong = connect.Spec(
    '/$name/UpdateSong',
    connect.StreamType.unary,
    kantahev1admin.UpdateSongRequest.new,
    kantahev1admin.UpdateSongResponse.new,
  );

  /// Admin only. Removes the entry and, unless keep_file is set, its file; fails with the reason if the file cannot be deleted.
  static const deleteSong = connect.Spec(
    '/$name/DeleteSong',
    connect.StreamType.unary,
    kantahev1admin.DeleteSongRequest.new,
    kantahev1admin.DeleteSongResponse.new,
  );

  /// Admin only. Removes many songs from the list at once. The song files are never deleted, except with scope BROKEN and delete_files.
  static const removeSongs = connect.Spec(
    '/$name/RemoveSongs',
    connect.StreamType.unary,
    kantahev1admin.RemoveSongsRequest.new,
    kantahev1admin.RemoveSongsResponse.new,
  );

  /// Admin only. Re-judges every live song (file missing, MIDI without music, unparsable, a .karmp3 whose audio cannot be read), marks the
  /// broken ones as failed (they leave every user's lists and searches) and clears the mark of repaired ones. Streams its progress; the
  /// last message has done = true. FAILED_PRECONDITION when a check is already running.
  static const checkLibrary = connect.Spec(
    '/$name/CheckLibrary',
    connect.StreamType.server,
    kantahev1admin.CheckLibraryRequest.new,
    kantahev1admin.CheckLibraryResponse.new,
  );

  /// Admin only. Lists the songs marked broken, with the reason, ordered by number.
  static const listBrokenSongs = connect.Spec(
    '/$name/ListBrokenSongs',
    connect.StreamType.unary,
    kantahev1admin.ListBrokenSongsRequest.new,
    kantahev1admin.ListBrokenSongsResponse.new,
  );

  /// Admin only. The background videos in loop order, each with a signed preview URL (1 hour).
  static const listVideos = connect.Spec(
    '/$name/ListVideos',
    connect.StreamType.unary,
    kantahev1admin.ListVideosRequest.new,
    kantahev1admin.ListVideosResponse.new,
  );

  /// Admin only. Renames or enables/disables a video; unset optional fields are left unchanged; NOT_FOUND for an unknown id.
  static const updateVideo = connect.Spec(
    '/$name/UpdateVideo',
    connect.StreamType.unary,
    kantahev1admin.UpdateVideoRequest.new,
    kantahev1admin.UpdateVideoResponse.new,
  );

  /// Admin only. Sets the loop order; ids must be exactly the existing ids (INVALID_ARGUMENT otherwise).
  static const reorderVideos = connect.Spec(
    '/$name/ReorderVideos',
    connect.StreamType.unary,
    kantahev1admin.ReorderVideosRequest.new,
    kantahev1admin.ReorderVideosResponse.new,
  );

  /// Admin only. Removes the video and its file; NOT_FOUND for an unknown id.
  static const deleteVideo = connect.Spec(
    '/$name/DeleteVideo',
    connect.StreamType.unary,
    kantahev1admin.DeleteVideoRequest.new,
    kantahev1admin.DeleteVideoResponse.new,
  );

  /// Admin only. Rescans watched folders and reports the counts.
  static const rescan = connect.Spec(
    '/$name/Rescan',
    connect.StreamType.unary,
    kantahev1admin.RescanRequest.new,
    kantahev1admin.RescanResponse.new,
  );

  /// Admin only. Reads the server settings.
  static const getServerSettings = connect.Spec(
    '/$name/GetServerSettings',
    connect.StreamType.unary,
    kantahev1admin.GetServerSettingsRequest.new,
    kantahev1admin.GetServerSettingsResponse.new,
  );

  /// Admin only. Unset optional fields are left unchanged; INVALID_ARGUMENT for out-of-range values.
  static const updateServerSettings = connect.Spec(
    '/$name/UpdateServerSettings',
    connect.StreamType.unary,
    kantahev1admin.UpdateServerSettingsRequest.new,
    kantahev1admin.UpdateServerSettingsResponse.new,
  );
}
