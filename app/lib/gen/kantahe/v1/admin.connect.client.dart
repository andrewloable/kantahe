//
//  Generated code. Do not modify.
//  source: kantahe/v1/admin.proto
//

import "package:connectrpc/connect.dart" as connect;
import "admin.pb.dart" as kantahev1admin;
import "admin.connect.spec.dart" as specs;

/// Administration; every RPC requires the admin role (PERMISSION_DENIED otherwise).
extension type AdminServiceClient (connect.Transport _transport) {
  /// Admin only. Lists every user.
  Future<kantahev1admin.ListUsersResponse> listUsers(
    kantahev1admin.ListUsersRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.listUsers,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. ALREADY_EXISTS for a duplicate email; the user must change the temporary password.
  Future<kantahev1admin.CreateUserResponse> createUser(
    kantahev1admin.CreateUserRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.createUser,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Unset optional fields are left unchanged; the last admin cannot be demoted or disabled.
  Future<kantahev1admin.UpdateUserResponse> updateUser(
    kantahev1admin.UpdateUserRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.updateUser,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Sets a temporary password, must_change_password, and revokes the user's devices.
  Future<kantahev1admin.ResetPasswordResponse> resetPassword(
    kantahev1admin.ResetPasswordRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.resetPassword,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. The last admin cannot be deleted.
  Future<kantahev1admin.DeleteUserResponse> deleteUser(
    kantahev1admin.DeleteUserRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.deleteUser,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Signs out every device of the user and returns how many.
  Future<kantahev1admin.RevokeUserDevicesResponse> revokeUserDevices(
    kantahev1admin.RevokeUserDevicesRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.revokeUserDevices,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Title and artist edits survive rescans and always win over file metadata.
  Future<kantahev1admin.UpdateSongResponse> updateSong(
    kantahev1admin.UpdateSongRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.updateSong,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Removes the entry and, unless keep_file is set, its file; fails with the reason if the file cannot be deleted.
  Future<kantahev1admin.DeleteSongResponse> deleteSong(
    kantahev1admin.DeleteSongRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.deleteSong,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Removes many songs from the list at once. The song files are never deleted, except with scope BROKEN and delete_files.
  Future<kantahev1admin.RemoveSongsResponse> removeSongs(
    kantahev1admin.RemoveSongsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.removeSongs,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Re-judges every live song (file missing, MIDI without music, unparsable, a .karmp3 whose audio cannot be read), marks the
  /// broken ones as failed (they leave every user's lists and searches) and clears the mark of repaired ones. Streams its progress; the
  /// last message has done = true. FAILED_PRECONDITION when a check is already running.
  Stream<kantahev1admin.CheckLibraryResponse> checkLibrary(
    kantahev1admin.CheckLibraryRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).server(
      specs.AdminService.checkLibrary,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Lists the songs marked broken, with the reason, ordered by number.
  Future<kantahev1admin.ListBrokenSongsResponse> listBrokenSongs(
    kantahev1admin.ListBrokenSongsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.listBrokenSongs,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. The background videos in loop order, each with a signed preview URL (1 hour).
  Future<kantahev1admin.ListVideosResponse> listVideos(
    kantahev1admin.ListVideosRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.listVideos,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Renames or enables/disables a video; unset optional fields are left unchanged; NOT_FOUND for an unknown id.
  Future<kantahev1admin.UpdateVideoResponse> updateVideo(
    kantahev1admin.UpdateVideoRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.updateVideo,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Sets the loop order; ids must be exactly the existing ids (INVALID_ARGUMENT otherwise).
  Future<kantahev1admin.ReorderVideosResponse> reorderVideos(
    kantahev1admin.ReorderVideosRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.reorderVideos,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Removes the video and its file; NOT_FOUND for an unknown id.
  Future<kantahev1admin.DeleteVideoResponse> deleteVideo(
    kantahev1admin.DeleteVideoRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.deleteVideo,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Rescans watched folders and reports the counts.
  Future<kantahev1admin.RescanResponse> rescan(
    kantahev1admin.RescanRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.rescan,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Reads the server settings.
  Future<kantahev1admin.GetServerSettingsResponse> getServerSettings(
    kantahev1admin.GetServerSettingsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.getServerSettings,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Admin only. Unset optional fields are left unchanged; INVALID_ARGUMENT for out-of-range values.
  Future<kantahev1admin.UpdateServerSettingsResponse> updateServerSettings(
    kantahev1admin.UpdateServerSettingsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AdminService.updateServerSettings,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }
}
