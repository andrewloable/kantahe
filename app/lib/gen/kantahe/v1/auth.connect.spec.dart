//
//  Generated code. Do not modify.
//  source: kantahe/v1/auth.proto
//

import "package:connectrpc/connect.dart" as connect;
import "auth.pb.dart" as kantahev1auth;

/// Sign-in, tokens, devices and TV code sign-in (plan 5).
abstract final class AuthService {
  /// Fully-qualified name of the AuthService service.
  static const name = 'kantahe.v1.AuthService';

  /// Public. Returns the server version and whether the first admin still has to be created.
  static const getServerInfo = connect.Spec(
    '/$name/GetServerInfo',
    connect.StreamType.unary,
    kantahev1auth.GetServerInfoRequest.new,
    kantahev1auth.GetServerInfoResponse.new,
  );

  /// Public, only while no user exists; FAILED_PRECONDITION once any user exists.
  static const setup = connect.Spec(
    '/$name/Setup',
    connect.StreamType.unary,
    kantahev1auth.SetupRequest.new,
    kantahev1auth.SetupResponse.new,
  );

  /// Public. UNAUTHENTICATED for bad credentials, PERMISSION_DENIED for a disabled user, RESOURCE_EXHAUSTED while backed off.
  static const login = connect.Spec(
    '/$name/Login',
    connect.StreamType.unary,
    kantahev1auth.LoginRequest.new,
    kantahev1auth.LoginResponse.new,
  );

  /// Signed-in user; revokes the calling device's token.
  static const logout = connect.Spec(
    '/$name/Logout',
    connect.StreamType.unary,
    kantahev1auth.LogoutRequest.new,
    kantahev1auth.LogoutResponse.new,
  );

  /// Signed-in user (also while must_change_password); PERMISSION_DENIED for a wrong current password, INVALID_ARGUMENT for a weak new one; revokes other devices.
  static const changePassword = connect.Spec(
    '/$name/ChangePassword',
    connect.StreamType.unary,
    kantahev1auth.ChangePasswordRequest.new,
    kantahev1auth.ChangePasswordResponse.new,
  );

  /// Signed-in user (also while must_change_password); returns the caller.
  static const me = connect.Spec(
    '/$name/Me',
    connect.StreamType.unary,
    kantahev1auth.MeRequest.new,
    kantahev1auth.MeResponse.new,
  );

  /// Signed-in user; lists only the caller's own devices.
  static const listMyDevices = connect.Spec(
    '/$name/ListMyDevices',
    connect.StreamType.unary,
    kantahev1auth.ListMyDevicesRequest.new,
    kantahev1auth.ListMyDevicesResponse.new,
  );

  /// Signed-in user; NOT_FOUND for a device that is not the caller's.
  static const revokeDevice = connect.Spec(
    '/$name/RevokeDevice',
    connect.StreamType.unary,
    kantahev1auth.RevokeDeviceRequest.new,
    kantahev1auth.RevokeDeviceResponse.new,
  );

  /// Public (TV): starts a 5-minute code sign-in; RESOURCE_EXHAUSTED after too many pending codes from one IP.
  static const startCodeLogin = connect.Spec(
    '/$name/StartCodeLogin',
    connect.StreamType.unary,
    kantahev1auth.StartCodeLoginRequest.new,
    kantahev1auth.StartCodeLoginResponse.new,
  );

  /// Public (TV): streams until the code is approved (token) or expires.
  static const waitCodeLogin = connect.Spec(
    '/$name/WaitCodeLogin',
    connect.StreamType.server,
    kantahev1auth.WaitCodeLoginRequest.new,
    kantahev1auth.WaitCodeLoginResponse.new,
  );

  /// Signed-in user approves a TV's code; NOT_FOUND for an unknown, used or expired code.
  static const approveCode = connect.Spec(
    '/$name/ApproveCode',
    connect.StreamType.unary,
    kantahev1auth.ApproveCodeRequest.new,
    kantahev1auth.ApproveCodeResponse.new,
  );
}
