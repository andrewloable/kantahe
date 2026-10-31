//
//  Generated code. Do not modify.
//  source: kantahe/v1/auth.proto
//

import "package:connectrpc/connect.dart" as connect;
import "auth.pb.dart" as kantahev1auth;
import "auth.connect.spec.dart" as specs;

/// Sign-in, tokens, devices and TV code sign-in (plan 5).
extension type AuthServiceClient (connect.Transport _transport) {
  /// Public. Returns the server version and whether the first admin still has to be created.
  Future<kantahev1auth.GetServerInfoResponse> getServerInfo(
    kantahev1auth.GetServerInfoRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.getServerInfo,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Public, only while no user exists; FAILED_PRECONDITION once any user exists.
  Future<kantahev1auth.SetupResponse> setup(
    kantahev1auth.SetupRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.setup,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Public. UNAUTHENTICATED for bad credentials, PERMISSION_DENIED for a disabled user, RESOURCE_EXHAUSTED while backed off.
  Future<kantahev1auth.LoginResponse> login(
    kantahev1auth.LoginRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.login,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; revokes the calling device's token.
  Future<kantahev1auth.LogoutResponse> logout(
    kantahev1auth.LogoutRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.logout,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user (also while must_change_password); PERMISSION_DENIED for a wrong current password, INVALID_ARGUMENT for a weak new one; revokes other devices.
  Future<kantahev1auth.ChangePasswordResponse> changePassword(
    kantahev1auth.ChangePasswordRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.changePassword,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user (also while must_change_password); returns the caller.
  Future<kantahev1auth.MeResponse> me(
    kantahev1auth.MeRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.me,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; lists only the caller's own devices.
  Future<kantahev1auth.ListMyDevicesResponse> listMyDevices(
    kantahev1auth.ListMyDevicesRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.listMyDevices,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; NOT_FOUND for a device that is not the caller's.
  Future<kantahev1auth.RevokeDeviceResponse> revokeDevice(
    kantahev1auth.RevokeDeviceRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.revokeDevice,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Public (TV): starts a 5-minute code sign-in; RESOURCE_EXHAUSTED after too many pending codes from one IP.
  Future<kantahev1auth.StartCodeLoginResponse> startCodeLogin(
    kantahev1auth.StartCodeLoginRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.startCodeLogin,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Public (TV): streams until the code is approved (token) or expires.
  Stream<kantahev1auth.WaitCodeLoginResponse> waitCodeLogin(
    kantahev1auth.WaitCodeLoginRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).server(
      specs.AuthService.waitCodeLogin,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user approves a TV's code; NOT_FOUND for an unknown, used or expired code.
  Future<kantahev1auth.ApproveCodeResponse> approveCode(
    kantahev1auth.ApproveCodeRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.AuthService.approveCode,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }
}
