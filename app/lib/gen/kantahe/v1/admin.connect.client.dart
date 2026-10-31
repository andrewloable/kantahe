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

  /// Admin only. Removes the entry and its file; fails with the reason if the file cannot be deleted.
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
