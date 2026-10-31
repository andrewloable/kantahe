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

  /// Admin only. Removes the entry and its file; fails with the reason if the file cannot be deleted.
  static const deleteSong = connect.Spec(
    '/$name/DeleteSong',
    connect.StreamType.unary,
    kantahev1admin.DeleteSongRequest.new,
    kantahev1admin.DeleteSongResponse.new,
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
