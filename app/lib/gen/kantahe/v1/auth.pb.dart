// This is a generated file - do not edit.
//
// Generated from kantahe/v1/auth.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:fixnum/fixnum.dart' as $fixnum;
import 'package:protobuf/protobuf.dart' as $pb;

import 'common.pb.dart' as $0;

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

/// Asks nothing.
class GetServerInfoRequest extends $pb.GeneratedMessage {
  factory GetServerInfoRequest() => GetServerInfoRequest._();

  GetServerInfoRequest._();

  factory GetServerInfoRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerInfoRequest()..mergeFromBuffer(data, registry);
  factory GetServerInfoRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerInfoRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetServerInfoRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetServerInfoRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerInfoRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerInfoRequest copyWith(void Function(GetServerInfoRequest) updates) =>
      super.copyWith((message) => updates(message as GetServerInfoRequest))
          as GetServerInfoRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetServerInfoRequest() / GetServerInfoRequest.new instead')
  static GetServerInfoRequest create() => GetServerInfoRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetServerInfoRequest._();
  @$core.override
  GetServerInfoRequest createEmptyInstance() => GetServerInfoRequest._();
  @$core.pragma('dart2js:noInline')
  static GetServerInfoRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetServerInfoRequest>(
          GetServerInfoRequest.$_createMessage);
  static GetServerInfoRequest? _defaultInstance;
}

/// Version string and whether Setup is still allowed.
class GetServerInfoResponse extends $pb.GeneratedMessage {
  factory GetServerInfoResponse({
    $core.String? version,
    $core.bool? setupRequired,
  }) {
    final result = GetServerInfoResponse._();
    if (version != null) result.version = version;
    if (setupRequired != null) result.setupRequired = setupRequired;
    return result;
  }

  GetServerInfoResponse._();

  factory GetServerInfoResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerInfoResponse()..mergeFromBuffer(data, registry);
  factory GetServerInfoResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerInfoResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetServerInfoResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetServerInfoResponse.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'version')
    ..aOB(2, _omitFieldNames ? '' : 'setupRequired')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerInfoResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerInfoResponse copyWith(
          void Function(GetServerInfoResponse) updates) =>
      super.copyWith((message) => updates(message as GetServerInfoResponse))
          as GetServerInfoResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetServerInfoResponse() / GetServerInfoResponse.new instead')
  static GetServerInfoResponse create() => GetServerInfoResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetServerInfoResponse._();
  @$core.override
  GetServerInfoResponse createEmptyInstance() => GetServerInfoResponse._();
  @$core.pragma('dart2js:noInline')
  static GetServerInfoResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetServerInfoResponse>(
          GetServerInfoResponse.$_createMessage);
  static GetServerInfoResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get version => $_getSZ(0);
  @$pb.TagNumber(1)
  set version($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasVersion() => $_has(0);
  @$pb.TagNumber(1)
  void clearVersion() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.bool get setupRequired => $_getBF(1);
  @$pb.TagNumber(2)
  set setupRequired($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasSetupRequired() => $_has(1);
  @$pb.TagNumber(2)
  void clearSetupRequired() => $_clearField(2);
}

/// Creates the first admin and signs in the calling device.
class SetupRequest extends $pb.GeneratedMessage {
  factory SetupRequest({
    $core.String? email,
    $core.String? password,
    $core.String? displayName,
    $core.String? deviceName,
    $0.DeviceType? deviceType,
  }) {
    final result = SetupRequest._();
    if (email != null) result.email = email;
    if (password != null) result.password = password;
    if (displayName != null) result.displayName = displayName;
    if (deviceName != null) result.deviceName = deviceName;
    if (deviceType != null) result.deviceType = deviceType;
    return result;
  }

  SetupRequest._();

  factory SetupRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetupRequest()..mergeFromBuffer(data, registry);
  factory SetupRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetupRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SetupRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SetupRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'email')
    ..aOS(2, _omitFieldNames ? '' : 'password')
    ..aOS(3, _omitFieldNames ? '' : 'displayName')
    ..aOS(4, _omitFieldNames ? '' : 'deviceName')
    ..aE<$0.DeviceType>(5, _omitFieldNames ? '' : 'deviceType',
        enumValues: $0.DeviceType.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetupRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetupRequest copyWith(void Function(SetupRequest) updates) =>
      super.copyWith((message) => updates(message as SetupRequest))
          as SetupRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use SetupRequest() / SetupRequest.new instead')
  static SetupRequest create() => SetupRequest._();
  static $pb.GeneratedMessage $_createMessage() => SetupRequest._();
  @$core.override
  SetupRequest createEmptyInstance() => SetupRequest._();
  @$core.pragma('dart2js:noInline')
  static SetupRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<SetupRequest>(
          SetupRequest.$_createMessage);
  static SetupRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get email => $_getSZ(0);
  @$pb.TagNumber(1)
  set email($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasEmail() => $_has(0);
  @$pb.TagNumber(1)
  void clearEmail() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get password => $_getSZ(1);
  @$pb.TagNumber(2)
  set password($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPassword() => $_has(1);
  @$pb.TagNumber(2)
  void clearPassword() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get displayName => $_getSZ(2);
  @$pb.TagNumber(3)
  set displayName($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasDisplayName() => $_has(2);
  @$pb.TagNumber(3)
  void clearDisplayName() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get deviceName => $_getSZ(3);
  @$pb.TagNumber(4)
  set deviceName($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasDeviceName() => $_has(3);
  @$pb.TagNumber(4)
  void clearDeviceName() => $_clearField(4);

  @$pb.TagNumber(5)
  $0.DeviceType get deviceType => $_getN(4);
  @$pb.TagNumber(5)
  set deviceType($0.DeviceType value) => $_setField(5, value);
  @$pb.TagNumber(5)
  $core.bool hasDeviceType() => $_has(4);
  @$pb.TagNumber(5)
  void clearDeviceType() => $_clearField(5);
}

/// The new admin's device token.
class SetupResponse extends $pb.GeneratedMessage {
  factory SetupResponse({
    $0.AuthToken? auth,
  }) {
    final result = SetupResponse._();
    if (auth != null) result.auth = auth;
    return result;
  }

  SetupResponse._();

  factory SetupResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetupResponse()..mergeFromBuffer(data, registry);
  factory SetupResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetupResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SetupResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SetupResponse.$_createMessage)
    ..aOM<$0.AuthToken>(1, _omitFieldNames ? '' : 'auth',
        subBuilder: $0.AuthToken.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetupResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetupResponse copyWith(void Function(SetupResponse) updates) =>
      super.copyWith((message) => updates(message as SetupResponse))
          as SetupResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use SetupResponse() / SetupResponse.new instead')
  static SetupResponse create() => SetupResponse._();
  static $pb.GeneratedMessage $_createMessage() => SetupResponse._();
  @$core.override
  SetupResponse createEmptyInstance() => SetupResponse._();
  @$core.pragma('dart2js:noInline')
  static SetupResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<SetupResponse>(
          SetupResponse.$_createMessage);
  static SetupResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.AuthToken get auth => $_getN(0);
  @$pb.TagNumber(1)
  set auth($0.AuthToken value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasAuth() => $_has(0);
  @$pb.TagNumber(1)
  void clearAuth() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.AuthToken ensureAuth() => $_ensure(0);
}

/// Email and password sign-in for one device.
class LoginRequest extends $pb.GeneratedMessage {
  factory LoginRequest({
    $core.String? email,
    $core.String? password,
    $core.String? deviceName,
    $0.DeviceType? deviceType,
  }) {
    final result = LoginRequest._();
    if (email != null) result.email = email;
    if (password != null) result.password = password;
    if (deviceName != null) result.deviceName = deviceName;
    if (deviceType != null) result.deviceType = deviceType;
    return result;
  }

  LoginRequest._();

  factory LoginRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LoginRequest()..mergeFromBuffer(data, registry);
  factory LoginRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LoginRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'LoginRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: LoginRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'email')
    ..aOS(2, _omitFieldNames ? '' : 'password')
    ..aOS(3, _omitFieldNames ? '' : 'deviceName')
    ..aE<$0.DeviceType>(4, _omitFieldNames ? '' : 'deviceType',
        enumValues: $0.DeviceType.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LoginRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LoginRequest copyWith(void Function(LoginRequest) updates) =>
      super.copyWith((message) => updates(message as LoginRequest))
          as LoginRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use LoginRequest() / LoginRequest.new instead')
  static LoginRequest create() => LoginRequest._();
  static $pb.GeneratedMessage $_createMessage() => LoginRequest._();
  @$core.override
  LoginRequest createEmptyInstance() => LoginRequest._();
  @$core.pragma('dart2js:noInline')
  static LoginRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<LoginRequest>(
          LoginRequest.$_createMessage);
  static LoginRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get email => $_getSZ(0);
  @$pb.TagNumber(1)
  set email($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasEmail() => $_has(0);
  @$pb.TagNumber(1)
  void clearEmail() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get password => $_getSZ(1);
  @$pb.TagNumber(2)
  set password($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPassword() => $_has(1);
  @$pb.TagNumber(2)
  void clearPassword() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get deviceName => $_getSZ(2);
  @$pb.TagNumber(3)
  set deviceName($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasDeviceName() => $_has(2);
  @$pb.TagNumber(3)
  void clearDeviceName() => $_clearField(3);

  @$pb.TagNumber(4)
  $0.DeviceType get deviceType => $_getN(3);
  @$pb.TagNumber(4)
  set deviceType($0.DeviceType value) => $_setField(4, value);
  @$pb.TagNumber(4)
  $core.bool hasDeviceType() => $_has(3);
  @$pb.TagNumber(4)
  void clearDeviceType() => $_clearField(4);
}

/// The device token for the new device.
class LoginResponse extends $pb.GeneratedMessage {
  factory LoginResponse({
    $0.AuthToken? auth,
  }) {
    final result = LoginResponse._();
    if (auth != null) result.auth = auth;
    return result;
  }

  LoginResponse._();

  factory LoginResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LoginResponse()..mergeFromBuffer(data, registry);
  factory LoginResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LoginResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'LoginResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: LoginResponse.$_createMessage)
    ..aOM<$0.AuthToken>(1, _omitFieldNames ? '' : 'auth',
        subBuilder: $0.AuthToken.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LoginResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LoginResponse copyWith(void Function(LoginResponse) updates) =>
      super.copyWith((message) => updates(message as LoginResponse))
          as LoginResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use LoginResponse() / LoginResponse.new instead')
  static LoginResponse create() => LoginResponse._();
  static $pb.GeneratedMessage $_createMessage() => LoginResponse._();
  @$core.override
  LoginResponse createEmptyInstance() => LoginResponse._();
  @$core.pragma('dart2js:noInline')
  static LoginResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<LoginResponse>(
          LoginResponse.$_createMessage);
  static LoginResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.AuthToken get auth => $_getN(0);
  @$pb.TagNumber(1)
  set auth($0.AuthToken value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasAuth() => $_has(0);
  @$pb.TagNumber(1)
  void clearAuth() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.AuthToken ensureAuth() => $_ensure(0);
}

/// Asks nothing; the device is the caller's.
class LogoutRequest extends $pb.GeneratedMessage {
  factory LogoutRequest() => LogoutRequest._();

  LogoutRequest._();

  factory LogoutRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LogoutRequest()..mergeFromBuffer(data, registry);
  factory LogoutRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LogoutRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'LogoutRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: LogoutRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LogoutRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LogoutRequest copyWith(void Function(LogoutRequest) updates) =>
      super.copyWith((message) => updates(message as LogoutRequest))
          as LogoutRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use LogoutRequest() / LogoutRequest.new instead')
  static LogoutRequest create() => LogoutRequest._();
  static $pb.GeneratedMessage $_createMessage() => LogoutRequest._();
  @$core.override
  LogoutRequest createEmptyInstance() => LogoutRequest._();
  @$core.pragma('dart2js:noInline')
  static LogoutRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<LogoutRequest>(
          LogoutRequest.$_createMessage);
  static LogoutRequest? _defaultInstance;
}

/// Empty.
class LogoutResponse extends $pb.GeneratedMessage {
  factory LogoutResponse() => LogoutResponse._();

  LogoutResponse._();

  factory LogoutResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LogoutResponse()..mergeFromBuffer(data, registry);
  factory LogoutResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LogoutResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'LogoutResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: LogoutResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LogoutResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LogoutResponse copyWith(void Function(LogoutResponse) updates) =>
      super.copyWith((message) => updates(message as LogoutResponse))
          as LogoutResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use LogoutResponse() / LogoutResponse.new instead')
  static LogoutResponse create() => LogoutResponse._();
  static $pb.GeneratedMessage $_createMessage() => LogoutResponse._();
  @$core.override
  LogoutResponse createEmptyInstance() => LogoutResponse._();
  @$core.pragma('dart2js:noInline')
  static LogoutResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<LogoutResponse>(
          LogoutResponse.$_createMessage);
  static LogoutResponse? _defaultInstance;
}

/// Both passwords are checked server-side.
class ChangePasswordRequest extends $pb.GeneratedMessage {
  factory ChangePasswordRequest({
    $core.String? currentPassword,
    $core.String? newPassword,
  }) {
    final result = ChangePasswordRequest._();
    if (currentPassword != null) result.currentPassword = currentPassword;
    if (newPassword != null) result.newPassword = newPassword;
    return result;
  }

  ChangePasswordRequest._();

  factory ChangePasswordRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ChangePasswordRequest()..mergeFromBuffer(data, registry);
  factory ChangePasswordRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ChangePasswordRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ChangePasswordRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ChangePasswordRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'currentPassword')
    ..aOS(2, _omitFieldNames ? '' : 'newPassword')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ChangePasswordRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ChangePasswordRequest copyWith(
          void Function(ChangePasswordRequest) updates) =>
      super.copyWith((message) => updates(message as ChangePasswordRequest))
          as ChangePasswordRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ChangePasswordRequest() / ChangePasswordRequest.new instead')
  static ChangePasswordRequest create() => ChangePasswordRequest._();
  static $pb.GeneratedMessage $_createMessage() => ChangePasswordRequest._();
  @$core.override
  ChangePasswordRequest createEmptyInstance() => ChangePasswordRequest._();
  @$core.pragma('dart2js:noInline')
  static ChangePasswordRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ChangePasswordRequest>(
          ChangePasswordRequest.$_createMessage);
  static ChangePasswordRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get currentPassword => $_getSZ(0);
  @$pb.TagNumber(1)
  set currentPassword($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasCurrentPassword() => $_has(0);
  @$pb.TagNumber(1)
  void clearCurrentPassword() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get newPassword => $_getSZ(1);
  @$pb.TagNumber(2)
  set newPassword($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasNewPassword() => $_has(1);
  @$pb.TagNumber(2)
  void clearNewPassword() => $_clearField(2);
}

/// Empty.
class ChangePasswordResponse extends $pb.GeneratedMessage {
  factory ChangePasswordResponse() => ChangePasswordResponse._();

  ChangePasswordResponse._();

  factory ChangePasswordResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ChangePasswordResponse()..mergeFromBuffer(data, registry);
  factory ChangePasswordResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ChangePasswordResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ChangePasswordResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ChangePasswordResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ChangePasswordResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ChangePasswordResponse copyWith(
          void Function(ChangePasswordResponse) updates) =>
      super.copyWith((message) => updates(message as ChangePasswordResponse))
          as ChangePasswordResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ChangePasswordResponse() / ChangePasswordResponse.new instead')
  static ChangePasswordResponse create() => ChangePasswordResponse._();
  static $pb.GeneratedMessage $_createMessage() => ChangePasswordResponse._();
  @$core.override
  ChangePasswordResponse createEmptyInstance() => ChangePasswordResponse._();
  @$core.pragma('dart2js:noInline')
  static ChangePasswordResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ChangePasswordResponse>(
          ChangePasswordResponse.$_createMessage);
  static ChangePasswordResponse? _defaultInstance;
}

/// Asks nothing.
class MeRequest extends $pb.GeneratedMessage {
  factory MeRequest() => MeRequest._();

  MeRequest._();

  factory MeRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MeRequest()..mergeFromBuffer(data, registry);
  factory MeRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MeRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'MeRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: MeRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MeRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MeRequest copyWith(void Function(MeRequest) updates) =>
      super.copyWith((message) => updates(message as MeRequest)) as MeRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use MeRequest() / MeRequest.new instead')
  static MeRequest create() => MeRequest._();
  static $pb.GeneratedMessage $_createMessage() => MeRequest._();
  @$core.override
  MeRequest createEmptyInstance() => MeRequest._();
  @$core.pragma('dart2js:noInline')
  static MeRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<MeRequest>(MeRequest.$_createMessage);
  static MeRequest? _defaultInstance;
}

/// The calling user.
class MeResponse extends $pb.GeneratedMessage {
  factory MeResponse({
    $0.User? user,
  }) {
    final result = MeResponse._();
    if (user != null) result.user = user;
    return result;
  }

  MeResponse._();

  factory MeResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MeResponse()..mergeFromBuffer(data, registry);
  factory MeResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MeResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'MeResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: MeResponse.$_createMessage)
    ..aOM<$0.User>(1, _omitFieldNames ? '' : 'user',
        subBuilder: $0.User.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MeResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MeResponse copyWith(void Function(MeResponse) updates) =>
      super.copyWith((message) => updates(message as MeResponse)) as MeResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use MeResponse() / MeResponse.new instead')
  static MeResponse create() => MeResponse._();
  static $pb.GeneratedMessage $_createMessage() => MeResponse._();
  @$core.override
  MeResponse createEmptyInstance() => MeResponse._();
  @$core.pragma('dart2js:noInline')
  static MeResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<MeResponse>(MeResponse.$_createMessage);
  static MeResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.User get user => $_getN(0);
  @$pb.TagNumber(1)
  set user($0.User value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasUser() => $_has(0);
  @$pb.TagNumber(1)
  void clearUser() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.User ensureUser() => $_ensure(0);
}

/// Asks nothing.
class ListMyDevicesRequest extends $pb.GeneratedMessage {
  factory ListMyDevicesRequest() => ListMyDevicesRequest._();

  ListMyDevicesRequest._();

  factory ListMyDevicesRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListMyDevicesRequest()..mergeFromBuffer(data, registry);
  factory ListMyDevicesRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListMyDevicesRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListMyDevicesRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListMyDevicesRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListMyDevicesRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListMyDevicesRequest copyWith(void Function(ListMyDevicesRequest) updates) =>
      super.copyWith((message) => updates(message as ListMyDevicesRequest))
          as ListMyDevicesRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListMyDevicesRequest() / ListMyDevicesRequest.new instead')
  static ListMyDevicesRequest create() => ListMyDevicesRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListMyDevicesRequest._();
  @$core.override
  ListMyDevicesRequest createEmptyInstance() => ListMyDevicesRequest._();
  @$core.pragma('dart2js:noInline')
  static ListMyDevicesRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListMyDevicesRequest>(
          ListMyDevicesRequest.$_createMessage);
  static ListMyDevicesRequest? _defaultInstance;
}

/// The caller's devices, with is_caller set on one of them.
class ListMyDevicesResponse extends $pb.GeneratedMessage {
  factory ListMyDevicesResponse({
    $core.Iterable<$0.Device>? devices,
  }) {
    final result = ListMyDevicesResponse._();
    if (devices != null) result.devices.addAll(devices);
    return result;
  }

  ListMyDevicesResponse._();

  factory ListMyDevicesResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListMyDevicesResponse()..mergeFromBuffer(data, registry);
  factory ListMyDevicesResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListMyDevicesResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListMyDevicesResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListMyDevicesResponse.$_createMessage)
    ..pPM<$0.Device>(1, _omitFieldNames ? '' : 'devices',
        subBuilder: $0.Device.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListMyDevicesResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListMyDevicesResponse copyWith(
          void Function(ListMyDevicesResponse) updates) =>
      super.copyWith((message) => updates(message as ListMyDevicesResponse))
          as ListMyDevicesResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListMyDevicesResponse() / ListMyDevicesResponse.new instead')
  static ListMyDevicesResponse create() => ListMyDevicesResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListMyDevicesResponse._();
  @$core.override
  ListMyDevicesResponse createEmptyInstance() => ListMyDevicesResponse._();
  @$core.pragma('dart2js:noInline')
  static ListMyDevicesResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListMyDevicesResponse>(
          ListMyDevicesResponse.$_createMessage);
  static ListMyDevicesResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<$0.Device> get devices => $_getList(0);
}

/// The device to sign out.
class RevokeDeviceRequest extends $pb.GeneratedMessage {
  factory RevokeDeviceRequest({
    $core.String? deviceId,
  }) {
    final result = RevokeDeviceRequest._();
    if (deviceId != null) result.deviceId = deviceId;
    return result;
  }

  RevokeDeviceRequest._();

  factory RevokeDeviceRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeDeviceRequest()..mergeFromBuffer(data, registry);
  factory RevokeDeviceRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeDeviceRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RevokeDeviceRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RevokeDeviceRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'deviceId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeDeviceRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeDeviceRequest copyWith(void Function(RevokeDeviceRequest) updates) =>
      super.copyWith((message) => updates(message as RevokeDeviceRequest))
          as RevokeDeviceRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use RevokeDeviceRequest() / RevokeDeviceRequest.new instead')
  static RevokeDeviceRequest create() => RevokeDeviceRequest._();
  static $pb.GeneratedMessage $_createMessage() => RevokeDeviceRequest._();
  @$core.override
  RevokeDeviceRequest createEmptyInstance() => RevokeDeviceRequest._();
  @$core.pragma('dart2js:noInline')
  static RevokeDeviceRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RevokeDeviceRequest>(
          RevokeDeviceRequest.$_createMessage);
  static RevokeDeviceRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get deviceId => $_getSZ(0);
  @$pb.TagNumber(1)
  set deviceId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasDeviceId() => $_has(0);
  @$pb.TagNumber(1)
  void clearDeviceId() => $_clearField(1);
}

/// Empty.
class RevokeDeviceResponse extends $pb.GeneratedMessage {
  factory RevokeDeviceResponse() => RevokeDeviceResponse._();

  RevokeDeviceResponse._();

  factory RevokeDeviceResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeDeviceResponse()..mergeFromBuffer(data, registry);
  factory RevokeDeviceResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeDeviceResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RevokeDeviceResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RevokeDeviceResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeDeviceResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeDeviceResponse copyWith(void Function(RevokeDeviceResponse) updates) =>
      super.copyWith((message) => updates(message as RevokeDeviceResponse))
          as RevokeDeviceResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RevokeDeviceResponse() / RevokeDeviceResponse.new instead')
  static RevokeDeviceResponse create() => RevokeDeviceResponse._();
  static $pb.GeneratedMessage $_createMessage() => RevokeDeviceResponse._();
  @$core.override
  RevokeDeviceResponse createEmptyInstance() => RevokeDeviceResponse._();
  @$core.pragma('dart2js:noInline')
  static RevokeDeviceResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RevokeDeviceResponse>(
          RevokeDeviceResponse.$_createMessage);
  static RevokeDeviceResponse? _defaultInstance;
}

/// The TV names itself so the approver can recognise it.
class StartCodeLoginRequest extends $pb.GeneratedMessage {
  factory StartCodeLoginRequest({
    $core.String? deviceName,
    $0.DeviceType? deviceType,
  }) {
    final result = StartCodeLoginRequest._();
    if (deviceName != null) result.deviceName = deviceName;
    if (deviceType != null) result.deviceType = deviceType;
    return result;
  }

  StartCodeLoginRequest._();

  factory StartCodeLoginRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      StartCodeLoginRequest()..mergeFromBuffer(data, registry);
  factory StartCodeLoginRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      StartCodeLoginRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'StartCodeLoginRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: StartCodeLoginRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'deviceName')
    ..aE<$0.DeviceType>(2, _omitFieldNames ? '' : 'deviceType',
        enumValues: $0.DeviceType.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  StartCodeLoginRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  StartCodeLoginRequest copyWith(
          void Function(StartCodeLoginRequest) updates) =>
      super.copyWith((message) => updates(message as StartCodeLoginRequest))
          as StartCodeLoginRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use StartCodeLoginRequest() / StartCodeLoginRequest.new instead')
  static StartCodeLoginRequest create() => StartCodeLoginRequest._();
  static $pb.GeneratedMessage $_createMessage() => StartCodeLoginRequest._();
  @$core.override
  StartCodeLoginRequest createEmptyInstance() => StartCodeLoginRequest._();
  @$core.pragma('dart2js:noInline')
  static StartCodeLoginRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<StartCodeLoginRequest>(
          StartCodeLoginRequest.$_createMessage);
  static StartCodeLoginRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get deviceName => $_getSZ(0);
  @$pb.TagNumber(1)
  set deviceName($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasDeviceName() => $_has(0);
  @$pb.TagNumber(1)
  void clearDeviceName() => $_clearField(1);

  @$pb.TagNumber(2)
  $0.DeviceType get deviceType => $_getN(1);
  @$pb.TagNumber(2)
  set deviceType($0.DeviceType value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasDeviceType() => $_has(1);
  @$pb.TagNumber(2)
  void clearDeviceType() => $_clearField(2);
}

/// login_id is a secret the TV keeps; code is the 6-character code shown to the user.
class StartCodeLoginResponse extends $pb.GeneratedMessage {
  factory StartCodeLoginResponse({
    $core.String? loginId,
    $core.String? code,
    $fixnum.Int64? expiresAtUnix,
    $core.String? approveUrl,
  }) {
    final result = StartCodeLoginResponse._();
    if (loginId != null) result.loginId = loginId;
    if (code != null) result.code = code;
    if (expiresAtUnix != null) result.expiresAtUnix = expiresAtUnix;
    if (approveUrl != null) result.approveUrl = approveUrl;
    return result;
  }

  StartCodeLoginResponse._();

  factory StartCodeLoginResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      StartCodeLoginResponse()..mergeFromBuffer(data, registry);
  factory StartCodeLoginResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      StartCodeLoginResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'StartCodeLoginResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: StartCodeLoginResponse.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'loginId')
    ..aOS(2, _omitFieldNames ? '' : 'code')
    ..aInt64(3, _omitFieldNames ? '' : 'expiresAtUnix')
    ..aOS(4, _omitFieldNames ? '' : 'approveUrl')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  StartCodeLoginResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  StartCodeLoginResponse copyWith(
          void Function(StartCodeLoginResponse) updates) =>
      super.copyWith((message) => updates(message as StartCodeLoginResponse))
          as StartCodeLoginResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use StartCodeLoginResponse() / StartCodeLoginResponse.new instead')
  static StartCodeLoginResponse create() => StartCodeLoginResponse._();
  static $pb.GeneratedMessage $_createMessage() => StartCodeLoginResponse._();
  @$core.override
  StartCodeLoginResponse createEmptyInstance() => StartCodeLoginResponse._();
  @$core.pragma('dart2js:noInline')
  static StartCodeLoginResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<StartCodeLoginResponse>(
          StartCodeLoginResponse.$_createMessage);
  static StartCodeLoginResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get loginId => $_getSZ(0);
  @$pb.TagNumber(1)
  set loginId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasLoginId() => $_has(0);
  @$pb.TagNumber(1)
  void clearLoginId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get code => $_getSZ(1);
  @$pb.TagNumber(2)
  set code($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasCode() => $_has(1);
  @$pb.TagNumber(2)
  void clearCode() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get expiresAtUnix => $_getI64(2);
  @$pb.TagNumber(3)
  set expiresAtUnix($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasExpiresAtUnix() => $_has(2);
  @$pb.TagNumber(3)
  void clearExpiresAtUnix() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get approveUrl => $_getSZ(3);
  @$pb.TagNumber(4)
  set approveUrl($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasApproveUrl() => $_has(3);
  @$pb.TagNumber(4)
  void clearApproveUrl() => $_clearField(4);
}

/// The secret from StartCodeLogin.
class WaitCodeLoginRequest extends $pb.GeneratedMessage {
  factory WaitCodeLoginRequest({
    $core.String? loginId,
  }) {
    final result = WaitCodeLoginRequest._();
    if (loginId != null) result.loginId = loginId;
    return result;
  }

  WaitCodeLoginRequest._();

  factory WaitCodeLoginRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WaitCodeLoginRequest()..mergeFromBuffer(data, registry);
  factory WaitCodeLoginRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WaitCodeLoginRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'WaitCodeLoginRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: WaitCodeLoginRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'loginId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WaitCodeLoginRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WaitCodeLoginRequest copyWith(void Function(WaitCodeLoginRequest) updates) =>
      super.copyWith((message) => updates(message as WaitCodeLoginRequest))
          as WaitCodeLoginRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use WaitCodeLoginRequest() / WaitCodeLoginRequest.new instead')
  static WaitCodeLoginRequest create() => WaitCodeLoginRequest._();
  static $pb.GeneratedMessage $_createMessage() => WaitCodeLoginRequest._();
  @$core.override
  WaitCodeLoginRequest createEmptyInstance() => WaitCodeLoginRequest._();
  @$core.pragma('dart2js:noInline')
  static WaitCodeLoginRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<WaitCodeLoginRequest>(
          WaitCodeLoginRequest.$_createMessage);
  static WaitCodeLoginRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get loginId => $_getSZ(0);
  @$pb.TagNumber(1)
  set loginId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasLoginId() => $_has(0);
  @$pb.TagNumber(1)
  void clearLoginId() => $_clearField(1);
}

enum WaitCodeLoginResponse_Result { approved, expired, notSet }

/// Exactly one event: approved with the token, or expired.
class WaitCodeLoginResponse extends $pb.GeneratedMessage {
  factory WaitCodeLoginResponse({
    $0.AuthToken? approved,
    $core.bool? expired,
  }) {
    final result = WaitCodeLoginResponse._();
    if (approved != null) result.approved = approved;
    if (expired != null) result.expired = expired;
    return result;
  }

  WaitCodeLoginResponse._();

  factory WaitCodeLoginResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WaitCodeLoginResponse()..mergeFromBuffer(data, registry);
  factory WaitCodeLoginResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WaitCodeLoginResponse()..mergeFromJson(json, registry);

  static const $core.Map<$core.int, WaitCodeLoginResponse_Result>
      _WaitCodeLoginResponse_ResultByTag = {
    1: WaitCodeLoginResponse_Result.approved,
    2: WaitCodeLoginResponse_Result.expired,
    0: WaitCodeLoginResponse_Result.notSet
  };
  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'WaitCodeLoginResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: WaitCodeLoginResponse.$_createMessage)
    ..oo(0, [1, 2])
    ..aOM<$0.AuthToken>(1, _omitFieldNames ? '' : 'approved',
        subBuilder: $0.AuthToken.$_createMessage)
    ..aOB(2, _omitFieldNames ? '' : 'expired')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WaitCodeLoginResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WaitCodeLoginResponse copyWith(
          void Function(WaitCodeLoginResponse) updates) =>
      super.copyWith((message) => updates(message as WaitCodeLoginResponse))
          as WaitCodeLoginResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use WaitCodeLoginResponse() / WaitCodeLoginResponse.new instead')
  static WaitCodeLoginResponse create() => WaitCodeLoginResponse._();
  static $pb.GeneratedMessage $_createMessage() => WaitCodeLoginResponse._();
  @$core.override
  WaitCodeLoginResponse createEmptyInstance() => WaitCodeLoginResponse._();
  @$core.pragma('dart2js:noInline')
  static WaitCodeLoginResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<WaitCodeLoginResponse>(
          WaitCodeLoginResponse.$_createMessage);
  static WaitCodeLoginResponse? _defaultInstance;

  @$pb.TagNumber(1)
  @$pb.TagNumber(2)
  WaitCodeLoginResponse_Result whichResult() =>
      _WaitCodeLoginResponse_ResultByTag[$_whichOneof(0)]!;
  @$pb.TagNumber(1)
  @$pb.TagNumber(2)
  void clearResult() => $_clearField($_whichOneof(0));

  @$pb.TagNumber(1)
  $0.AuthToken get approved => $_getN(0);
  @$pb.TagNumber(1)
  set approved($0.AuthToken value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasApproved() => $_has(0);
  @$pb.TagNumber(1)
  void clearApproved() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.AuthToken ensureApproved() => $_ensure(0);

  @$pb.TagNumber(2)
  $core.bool get expired => $_getBF(1);
  @$pb.TagNumber(2)
  set expired($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasExpired() => $_has(1);
  @$pb.TagNumber(2)
  void clearExpired() => $_clearField(2);
}

/// The code shown on the TV.
class ApproveCodeRequest extends $pb.GeneratedMessage {
  factory ApproveCodeRequest({
    $core.String? code,
  }) {
    final result = ApproveCodeRequest._();
    if (code != null) result.code = code;
    return result;
  }

  ApproveCodeRequest._();

  factory ApproveCodeRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ApproveCodeRequest()..mergeFromBuffer(data, registry);
  factory ApproveCodeRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ApproveCodeRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ApproveCodeRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ApproveCodeRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'code')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ApproveCodeRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ApproveCodeRequest copyWith(void Function(ApproveCodeRequest) updates) =>
      super.copyWith((message) => updates(message as ApproveCodeRequest))
          as ApproveCodeRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ApproveCodeRequest() / ApproveCodeRequest.new instead')
  static ApproveCodeRequest create() => ApproveCodeRequest._();
  static $pb.GeneratedMessage $_createMessage() => ApproveCodeRequest._();
  @$core.override
  ApproveCodeRequest createEmptyInstance() => ApproveCodeRequest._();
  @$core.pragma('dart2js:noInline')
  static ApproveCodeRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ApproveCodeRequest>(
          ApproveCodeRequest.$_createMessage);
  static ApproveCodeRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get code => $_getSZ(0);
  @$pb.TagNumber(1)
  set code($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasCode() => $_has(0);
  @$pb.TagNumber(1)
  void clearCode() => $_clearField(1);
}

/// The name of the TV that was approved.
class ApproveCodeResponse extends $pb.GeneratedMessage {
  factory ApproveCodeResponse({
    $core.String? deviceName,
  }) {
    final result = ApproveCodeResponse._();
    if (deviceName != null) result.deviceName = deviceName;
    return result;
  }

  ApproveCodeResponse._();

  factory ApproveCodeResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ApproveCodeResponse()..mergeFromBuffer(data, registry);
  factory ApproveCodeResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ApproveCodeResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ApproveCodeResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ApproveCodeResponse.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'deviceName')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ApproveCodeResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ApproveCodeResponse copyWith(void Function(ApproveCodeResponse) updates) =>
      super.copyWith((message) => updates(message as ApproveCodeResponse))
          as ApproveCodeResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use ApproveCodeResponse() / ApproveCodeResponse.new instead')
  static ApproveCodeResponse create() => ApproveCodeResponse._();
  static $pb.GeneratedMessage $_createMessage() => ApproveCodeResponse._();
  @$core.override
  ApproveCodeResponse createEmptyInstance() => ApproveCodeResponse._();
  @$core.pragma('dart2js:noInline')
  static ApproveCodeResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ApproveCodeResponse>(
          ApproveCodeResponse.$_createMessage);
  static ApproveCodeResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get deviceName => $_getSZ(0);
  @$pb.TagNumber(1)
  set deviceName($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasDeviceName() => $_has(0);
  @$pb.TagNumber(1)
  void clearDeviceName() => $_clearField(1);
}

/// Sign-in, tokens, devices and TV code sign-in (plan 5).
class AuthServiceApi {
  final $pb.RpcClient _client;

  AuthServiceApi(this._client);

  /// Public. Returns the server version and whether the first admin still has to be created.
  $async.Future<GetServerInfoResponse> getServerInfo(
          $pb.ClientContext? ctx, GetServerInfoRequest request) =>
      _client.invoke<GetServerInfoResponse>(ctx, 'AuthService', 'GetServerInfo',
          request, GetServerInfoResponse());

  /// Public, only while no user exists; FAILED_PRECONDITION once any user exists.
  $async.Future<SetupResponse> setup(
          $pb.ClientContext? ctx, SetupRequest request) =>
      _client.invoke<SetupResponse>(
          ctx, 'AuthService', 'Setup', request, SetupResponse());

  /// Public. UNAUTHENTICATED for bad credentials, PERMISSION_DENIED for a disabled user, RESOURCE_EXHAUSTED while backed off.
  $async.Future<LoginResponse> login(
          $pb.ClientContext? ctx, LoginRequest request) =>
      _client.invoke<LoginResponse>(
          ctx, 'AuthService', 'Login', request, LoginResponse());

  /// Signed-in user; revokes the calling device's token.
  $async.Future<LogoutResponse> logout(
          $pb.ClientContext? ctx, LogoutRequest request) =>
      _client.invoke<LogoutResponse>(
          ctx, 'AuthService', 'Logout', request, LogoutResponse());

  /// Signed-in user (also while must_change_password); PERMISSION_DENIED for a wrong current password, INVALID_ARGUMENT for a weak new one; revokes other devices.
  $async.Future<ChangePasswordResponse> changePassword(
          $pb.ClientContext? ctx, ChangePasswordRequest request) =>
      _client.invoke<ChangePasswordResponse>(ctx, 'AuthService',
          'ChangePassword', request, ChangePasswordResponse());

  /// Signed-in user (also while must_change_password); returns the caller.
  $async.Future<MeResponse> me($pb.ClientContext? ctx, MeRequest request) =>
      _client.invoke<MeResponse>(
          ctx, 'AuthService', 'Me', request, MeResponse());

  /// Signed-in user; lists only the caller's own devices.
  $async.Future<ListMyDevicesResponse> listMyDevices(
          $pb.ClientContext? ctx, ListMyDevicesRequest request) =>
      _client.invoke<ListMyDevicesResponse>(ctx, 'AuthService', 'ListMyDevices',
          request, ListMyDevicesResponse());

  /// Signed-in user; NOT_FOUND for a device that is not the caller's.
  $async.Future<RevokeDeviceResponse> revokeDevice(
          $pb.ClientContext? ctx, RevokeDeviceRequest request) =>
      _client.invoke<RevokeDeviceResponse>(
          ctx, 'AuthService', 'RevokeDevice', request, RevokeDeviceResponse());

  /// Public (TV): starts a 5-minute code sign-in; RESOURCE_EXHAUSTED after too many pending codes from one IP.
  $async.Future<StartCodeLoginResponse> startCodeLogin(
          $pb.ClientContext? ctx, StartCodeLoginRequest request) =>
      _client.invoke<StartCodeLoginResponse>(ctx, 'AuthService',
          'StartCodeLogin', request, StartCodeLoginResponse());

  /// Public (TV): streams until the code is approved (token) or expires.
  $async.Future<WaitCodeLoginResponse> waitCodeLogin(
          $pb.ClientContext? ctx, WaitCodeLoginRequest request) =>
      _client.invoke<WaitCodeLoginResponse>(ctx, 'AuthService', 'WaitCodeLogin',
          request, WaitCodeLoginResponse());

  /// Signed-in user approves a TV's code; NOT_FOUND for an unknown, used or expired code.
  $async.Future<ApproveCodeResponse> approveCode(
          $pb.ClientContext? ctx, ApproveCodeRequest request) =>
      _client.invoke<ApproveCodeResponse>(
          ctx, 'AuthService', 'ApproveCode', request, ApproveCodeResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
