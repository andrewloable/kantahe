// This is a generated file - do not edit.
//
// Generated from kantahe/v1/admin.proto.

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

import 'admin.pbenum.dart';
import 'common.pb.dart' as $0;

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

export 'admin.pbenum.dart';

/// Asks nothing.
class ListUsersRequest extends $pb.GeneratedMessage {
  factory ListUsersRequest() => ListUsersRequest._();

  ListUsersRequest._();

  factory ListUsersRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListUsersRequest()..mergeFromBuffer(data, registry);
  factory ListUsersRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListUsersRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListUsersRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListUsersRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListUsersRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListUsersRequest copyWith(void Function(ListUsersRequest) updates) =>
      super.copyWith((message) => updates(message as ListUsersRequest))
          as ListUsersRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ListUsersRequest() / ListUsersRequest.new instead')
  static ListUsersRequest create() => ListUsersRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListUsersRequest._();
  @$core.override
  ListUsersRequest createEmptyInstance() => ListUsersRequest._();
  @$core.pragma('dart2js:noInline')
  static ListUsersRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ListUsersRequest>(
          ListUsersRequest.$_createMessage);
  static ListUsersRequest? _defaultInstance;
}

/// All users.
class ListUsersResponse extends $pb.GeneratedMessage {
  factory ListUsersResponse({
    $core.Iterable<$0.User>? users,
  }) {
    final result = ListUsersResponse._();
    if (users != null) result.users.addAll(users);
    return result;
  }

  ListUsersResponse._();

  factory ListUsersResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListUsersResponse()..mergeFromBuffer(data, registry);
  factory ListUsersResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListUsersResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListUsersResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListUsersResponse.$_createMessage)
    ..pPM<$0.User>(1, _omitFieldNames ? '' : 'users',
        subBuilder: $0.User.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListUsersResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListUsersResponse copyWith(void Function(ListUsersResponse) updates) =>
      super.copyWith((message) => updates(message as ListUsersResponse))
          as ListUsersResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ListUsersResponse() / ListUsersResponse.new instead')
  static ListUsersResponse create() => ListUsersResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListUsersResponse._();
  @$core.override
  ListUsersResponse createEmptyInstance() => ListUsersResponse._();
  @$core.pragma('dart2js:noInline')
  static ListUsersResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ListUsersResponse>(
          ListUsersResponse.$_createMessage);
  static ListUsersResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<$0.User> get users => $_getList(0);
}

/// A new account with a temporary password.
class CreateUserRequest extends $pb.GeneratedMessage {
  factory CreateUserRequest({
    $core.String? email,
    $core.String? displayName,
    $core.String? temporaryPassword,
    $core.bool? admin,
    $core.bool? uploader,
  }) {
    final result = CreateUserRequest._();
    if (email != null) result.email = email;
    if (displayName != null) result.displayName = displayName;
    if (temporaryPassword != null) result.temporaryPassword = temporaryPassword;
    if (admin != null) result.admin = admin;
    if (uploader != null) result.uploader = uploader;
    return result;
  }

  CreateUserRequest._();

  factory CreateUserRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreateUserRequest()..mergeFromBuffer(data, registry);
  factory CreateUserRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreateUserRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CreateUserRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CreateUserRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'email')
    ..aOS(2, _omitFieldNames ? '' : 'displayName')
    ..aOS(3, _omitFieldNames ? '' : 'temporaryPassword')
    ..aOB(4, _omitFieldNames ? '' : 'admin')
    ..aOB(5, _omitFieldNames ? '' : 'uploader')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreateUserRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreateUserRequest copyWith(void Function(CreateUserRequest) updates) =>
      super.copyWith((message) => updates(message as CreateUserRequest))
          as CreateUserRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use CreateUserRequest() / CreateUserRequest.new instead')
  static CreateUserRequest create() => CreateUserRequest._();
  static $pb.GeneratedMessage $_createMessage() => CreateUserRequest._();
  @$core.override
  CreateUserRequest createEmptyInstance() => CreateUserRequest._();
  @$core.pragma('dart2js:noInline')
  static CreateUserRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<CreateUserRequest>(
          CreateUserRequest.$_createMessage);
  static CreateUserRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get email => $_getSZ(0);
  @$pb.TagNumber(1)
  set email($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasEmail() => $_has(0);
  @$pb.TagNumber(1)
  void clearEmail() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get displayName => $_getSZ(1);
  @$pb.TagNumber(2)
  set displayName($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasDisplayName() => $_has(1);
  @$pb.TagNumber(2)
  void clearDisplayName() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get temporaryPassword => $_getSZ(2);
  @$pb.TagNumber(3)
  set temporaryPassword($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasTemporaryPassword() => $_has(2);
  @$pb.TagNumber(3)
  void clearTemporaryPassword() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get admin => $_getBF(3);
  @$pb.TagNumber(4)
  set admin($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasAdmin() => $_has(3);
  @$pb.TagNumber(4)
  void clearAdmin() => $_clearField(4);

  /// Has no effect since 1.2.0: only administrators upload songs.
  @$pb.TagNumber(5)
  $core.bool get uploader => $_getBF(4);
  @$pb.TagNumber(5)
  set uploader($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasUploader() => $_has(4);
  @$pb.TagNumber(5)
  void clearUploader() => $_clearField(5);
}

/// The created user.
class CreateUserResponse extends $pb.GeneratedMessage {
  factory CreateUserResponse({
    $0.User? user,
  }) {
    final result = CreateUserResponse._();
    if (user != null) result.user = user;
    return result;
  }

  CreateUserResponse._();

  factory CreateUserResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreateUserResponse()..mergeFromBuffer(data, registry);
  factory CreateUserResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreateUserResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CreateUserResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CreateUserResponse.$_createMessage)
    ..aOM<$0.User>(1, _omitFieldNames ? '' : 'user',
        subBuilder: $0.User.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreateUserResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreateUserResponse copyWith(void Function(CreateUserResponse) updates) =>
      super.copyWith((message) => updates(message as CreateUserResponse))
          as CreateUserResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use CreateUserResponse() / CreateUserResponse.new instead')
  static CreateUserResponse create() => CreateUserResponse._();
  static $pb.GeneratedMessage $_createMessage() => CreateUserResponse._();
  @$core.override
  CreateUserResponse createEmptyInstance() => CreateUserResponse._();
  @$core.pragma('dart2js:noInline')
  static CreateUserResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CreateUserResponse>(
          CreateUserResponse.$_createMessage);
  static CreateUserResponse? _defaultInstance;

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

/// Partial update; only fields that are set change.
class UpdateUserRequest extends $pb.GeneratedMessage {
  factory UpdateUserRequest({
    $core.String? userId,
    $core.String? displayName,
    $core.bool? admin,
    $core.bool? uploader,
    $core.bool? disabled,
  }) {
    final result = UpdateUserRequest._();
    if (userId != null) result.userId = userId;
    if (displayName != null) result.displayName = displayName;
    if (admin != null) result.admin = admin;
    if (uploader != null) result.uploader = uploader;
    if (disabled != null) result.disabled = disabled;
    return result;
  }

  UpdateUserRequest._();

  factory UpdateUserRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserRequest()..mergeFromBuffer(data, registry);
  factory UpdateUserRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateUserRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateUserRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'userId')
    ..aOS(2, _omitFieldNames ? '' : 'displayName')
    ..aOB(3, _omitFieldNames ? '' : 'admin')
    ..aOB(4, _omitFieldNames ? '' : 'uploader')
    ..aOB(5, _omitFieldNames ? '' : 'disabled')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserRequest copyWith(void Function(UpdateUserRequest) updates) =>
      super.copyWith((message) => updates(message as UpdateUserRequest))
          as UpdateUserRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UpdateUserRequest() / UpdateUserRequest.new instead')
  static UpdateUserRequest create() => UpdateUserRequest._();
  static $pb.GeneratedMessage $_createMessage() => UpdateUserRequest._();
  @$core.override
  UpdateUserRequest createEmptyInstance() => UpdateUserRequest._();
  @$core.pragma('dart2js:noInline')
  static UpdateUserRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<UpdateUserRequest>(
          UpdateUserRequest.$_createMessage);
  static UpdateUserRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get userId => $_getSZ(0);
  @$pb.TagNumber(1)
  set userId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUserId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUserId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get displayName => $_getSZ(1);
  @$pb.TagNumber(2)
  set displayName($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasDisplayName() => $_has(1);
  @$pb.TagNumber(2)
  void clearDisplayName() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.bool get admin => $_getBF(2);
  @$pb.TagNumber(3)
  set admin($core.bool value) => $_setBool(2, value);
  @$pb.TagNumber(3)
  $core.bool hasAdmin() => $_has(2);
  @$pb.TagNumber(3)
  void clearAdmin() => $_clearField(3);

  /// Has no effect since 1.2.0: only administrators upload songs.
  @$pb.TagNumber(4)
  $core.bool get uploader => $_getBF(3);
  @$pb.TagNumber(4)
  set uploader($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasUploader() => $_has(3);
  @$pb.TagNumber(4)
  void clearUploader() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get disabled => $_getBF(4);
  @$pb.TagNumber(5)
  set disabled($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasDisabled() => $_has(4);
  @$pb.TagNumber(5)
  void clearDisabled() => $_clearField(5);
}

/// The user after the update.
class UpdateUserResponse extends $pb.GeneratedMessage {
  factory UpdateUserResponse({
    $0.User? user,
  }) {
    final result = UpdateUserResponse._();
    if (user != null) result.user = user;
    return result;
  }

  UpdateUserResponse._();

  factory UpdateUserResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserResponse()..mergeFromBuffer(data, registry);
  factory UpdateUserResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateUserResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateUserResponse.$_createMessage)
    ..aOM<$0.User>(1, _omitFieldNames ? '' : 'user',
        subBuilder: $0.User.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserResponse copyWith(void Function(UpdateUserResponse) updates) =>
      super.copyWith((message) => updates(message as UpdateUserResponse))
          as UpdateUserResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UpdateUserResponse() / UpdateUserResponse.new instead')
  static UpdateUserResponse create() => UpdateUserResponse._();
  static $pb.GeneratedMessage $_createMessage() => UpdateUserResponse._();
  @$core.override
  UpdateUserResponse createEmptyInstance() => UpdateUserResponse._();
  @$core.pragma('dart2js:noInline')
  static UpdateUserResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateUserResponse>(
          UpdateUserResponse.$_createMessage);
  static UpdateUserResponse? _defaultInstance;

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

/// A new temporary password for the user.
class ResetPasswordRequest extends $pb.GeneratedMessage {
  factory ResetPasswordRequest({
    $core.String? userId,
    $core.String? temporaryPassword,
  }) {
    final result = ResetPasswordRequest._();
    if (userId != null) result.userId = userId;
    if (temporaryPassword != null) result.temporaryPassword = temporaryPassword;
    return result;
  }

  ResetPasswordRequest._();

  factory ResetPasswordRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ResetPasswordRequest()..mergeFromBuffer(data, registry);
  factory ResetPasswordRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ResetPasswordRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ResetPasswordRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ResetPasswordRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'userId')
    ..aOS(2, _omitFieldNames ? '' : 'temporaryPassword')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ResetPasswordRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ResetPasswordRequest copyWith(void Function(ResetPasswordRequest) updates) =>
      super.copyWith((message) => updates(message as ResetPasswordRequest))
          as ResetPasswordRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ResetPasswordRequest() / ResetPasswordRequest.new instead')
  static ResetPasswordRequest create() => ResetPasswordRequest._();
  static $pb.GeneratedMessage $_createMessage() => ResetPasswordRequest._();
  @$core.override
  ResetPasswordRequest createEmptyInstance() => ResetPasswordRequest._();
  @$core.pragma('dart2js:noInline')
  static ResetPasswordRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ResetPasswordRequest>(
          ResetPasswordRequest.$_createMessage);
  static ResetPasswordRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get userId => $_getSZ(0);
  @$pb.TagNumber(1)
  set userId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUserId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUserId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get temporaryPassword => $_getSZ(1);
  @$pb.TagNumber(2)
  set temporaryPassword($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasTemporaryPassword() => $_has(1);
  @$pb.TagNumber(2)
  void clearTemporaryPassword() => $_clearField(2);
}

/// Empty.
class ResetPasswordResponse extends $pb.GeneratedMessage {
  factory ResetPasswordResponse() => ResetPasswordResponse._();

  ResetPasswordResponse._();

  factory ResetPasswordResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ResetPasswordResponse()..mergeFromBuffer(data, registry);
  factory ResetPasswordResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ResetPasswordResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ResetPasswordResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ResetPasswordResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ResetPasswordResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ResetPasswordResponse copyWith(
          void Function(ResetPasswordResponse) updates) =>
      super.copyWith((message) => updates(message as ResetPasswordResponse))
          as ResetPasswordResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ResetPasswordResponse() / ResetPasswordResponse.new instead')
  static ResetPasswordResponse create() => ResetPasswordResponse._();
  static $pb.GeneratedMessage $_createMessage() => ResetPasswordResponse._();
  @$core.override
  ResetPasswordResponse createEmptyInstance() => ResetPasswordResponse._();
  @$core.pragma('dart2js:noInline')
  static ResetPasswordResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ResetPasswordResponse>(
          ResetPasswordResponse.$_createMessage);
  static ResetPasswordResponse? _defaultInstance;
}

/// The user to delete.
class DeleteUserRequest extends $pb.GeneratedMessage {
  factory DeleteUserRequest({
    $core.String? userId,
  }) {
    final result = DeleteUserRequest._();
    if (userId != null) result.userId = userId;
    return result;
  }

  DeleteUserRequest._();

  factory DeleteUserRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteUserRequest()..mergeFromBuffer(data, registry);
  factory DeleteUserRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteUserRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeleteUserRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeleteUserRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'userId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteUserRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteUserRequest copyWith(void Function(DeleteUserRequest) updates) =>
      super.copyWith((message) => updates(message as DeleteUserRequest))
          as DeleteUserRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use DeleteUserRequest() / DeleteUserRequest.new instead')
  static DeleteUserRequest create() => DeleteUserRequest._();
  static $pb.GeneratedMessage $_createMessage() => DeleteUserRequest._();
  @$core.override
  DeleteUserRequest createEmptyInstance() => DeleteUserRequest._();
  @$core.pragma('dart2js:noInline')
  static DeleteUserRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<DeleteUserRequest>(
          DeleteUserRequest.$_createMessage);
  static DeleteUserRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get userId => $_getSZ(0);
  @$pb.TagNumber(1)
  set userId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUserId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUserId() => $_clearField(1);
}

/// Empty.
class DeleteUserResponse extends $pb.GeneratedMessage {
  factory DeleteUserResponse() => DeleteUserResponse._();

  DeleteUserResponse._();

  factory DeleteUserResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteUserResponse()..mergeFromBuffer(data, registry);
  factory DeleteUserResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteUserResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeleteUserResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeleteUserResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteUserResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteUserResponse copyWith(void Function(DeleteUserResponse) updates) =>
      super.copyWith((message) => updates(message as DeleteUserResponse))
          as DeleteUserResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use DeleteUserResponse() / DeleteUserResponse.new instead')
  static DeleteUserResponse create() => DeleteUserResponse._();
  static $pb.GeneratedMessage $_createMessage() => DeleteUserResponse._();
  @$core.override
  DeleteUserResponse createEmptyInstance() => DeleteUserResponse._();
  @$core.pragma('dart2js:noInline')
  static DeleteUserResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeleteUserResponse>(
          DeleteUserResponse.$_createMessage);
  static DeleteUserResponse? _defaultInstance;
}

/// The user whose devices are signed out.
class RevokeUserDevicesRequest extends $pb.GeneratedMessage {
  factory RevokeUserDevicesRequest({
    $core.String? userId,
  }) {
    final result = RevokeUserDevicesRequest._();
    if (userId != null) result.userId = userId;
    return result;
  }

  RevokeUserDevicesRequest._();

  factory RevokeUserDevicesRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeUserDevicesRequest()..mergeFromBuffer(data, registry);
  factory RevokeUserDevicesRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeUserDevicesRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RevokeUserDevicesRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RevokeUserDevicesRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'userId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeUserDevicesRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeUserDevicesRequest copyWith(
          void Function(RevokeUserDevicesRequest) updates) =>
      super.copyWith((message) => updates(message as RevokeUserDevicesRequest))
          as RevokeUserDevicesRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RevokeUserDevicesRequest() / RevokeUserDevicesRequest.new instead')
  static RevokeUserDevicesRequest create() => RevokeUserDevicesRequest._();
  static $pb.GeneratedMessage $_createMessage() => RevokeUserDevicesRequest._();
  @$core.override
  RevokeUserDevicesRequest createEmptyInstance() =>
      RevokeUserDevicesRequest._();
  @$core.pragma('dart2js:noInline')
  static RevokeUserDevicesRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RevokeUserDevicesRequest>(
          RevokeUserDevicesRequest.$_createMessage);
  static RevokeUserDevicesRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get userId => $_getSZ(0);
  @$pb.TagNumber(1)
  set userId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUserId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUserId() => $_clearField(1);
}

/// Number of devices signed out.
class RevokeUserDevicesResponse extends $pb.GeneratedMessage {
  factory RevokeUserDevicesResponse({
    $core.int? revoked,
  }) {
    final result = RevokeUserDevicesResponse._();
    if (revoked != null) result.revoked = revoked;
    return result;
  }

  RevokeUserDevicesResponse._();

  factory RevokeUserDevicesResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeUserDevicesResponse()..mergeFromBuffer(data, registry);
  factory RevokeUserDevicesResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RevokeUserDevicesResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RevokeUserDevicesResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RevokeUserDevicesResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'revoked')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeUserDevicesResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RevokeUserDevicesResponse copyWith(
          void Function(RevokeUserDevicesResponse) updates) =>
      super.copyWith((message) => updates(message as RevokeUserDevicesResponse))
          as RevokeUserDevicesResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RevokeUserDevicesResponse() / RevokeUserDevicesResponse.new instead')
  static RevokeUserDevicesResponse create() => RevokeUserDevicesResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      RevokeUserDevicesResponse._();
  @$core.override
  RevokeUserDevicesResponse createEmptyInstance() =>
      RevokeUserDevicesResponse._();
  @$core.pragma('dart2js:noInline')
  static RevokeUserDevicesResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RevokeUserDevicesResponse>(
          RevokeUserDevicesResponse.$_createMessage);
  static RevokeUserDevicesResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get revoked => $_getIZ(0);
  @$pb.TagNumber(1)
  set revoked($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasRevoked() => $_has(0);
  @$pb.TagNumber(1)
  void clearRevoked() => $_clearField(1);
}

/// Partial update of a song's displayed fields.
class UpdateSongRequest extends $pb.GeneratedMessage {
  factory UpdateSongRequest({
    $core.String? number,
    $core.String? title,
    $core.String? artist,
  }) {
    final result = UpdateSongRequest._();
    if (number != null) result.number = number;
    if (title != null) result.title = title;
    if (artist != null) result.artist = artist;
    return result;
  }

  UpdateSongRequest._();

  factory UpdateSongRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateSongRequest()..mergeFromBuffer(data, registry);
  factory UpdateSongRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateSongRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateSongRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateSongRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aOS(2, _omitFieldNames ? '' : 'title')
    ..aOS(3, _omitFieldNames ? '' : 'artist')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateSongRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateSongRequest copyWith(void Function(UpdateSongRequest) updates) =>
      super.copyWith((message) => updates(message as UpdateSongRequest))
          as UpdateSongRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UpdateSongRequest() / UpdateSongRequest.new instead')
  static UpdateSongRequest create() => UpdateSongRequest._();
  static $pb.GeneratedMessage $_createMessage() => UpdateSongRequest._();
  @$core.override
  UpdateSongRequest createEmptyInstance() => UpdateSongRequest._();
  @$core.pragma('dart2js:noInline')
  static UpdateSongRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<UpdateSongRequest>(
          UpdateSongRequest.$_createMessage);
  static UpdateSongRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get title => $_getSZ(1);
  @$pb.TagNumber(2)
  set title($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasTitle() => $_has(1);
  @$pb.TagNumber(2)
  void clearTitle() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get artist => $_getSZ(2);
  @$pb.TagNumber(3)
  set artist($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasArtist() => $_has(2);
  @$pb.TagNumber(3)
  void clearArtist() => $_clearField(3);
}

/// The song after the update.
class UpdateSongResponse extends $pb.GeneratedMessage {
  factory UpdateSongResponse({
    $0.Song? song,
  }) {
    final result = UpdateSongResponse._();
    if (song != null) result.song = song;
    return result;
  }

  UpdateSongResponse._();

  factory UpdateSongResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateSongResponse()..mergeFromBuffer(data, registry);
  factory UpdateSongResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateSongResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateSongResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateSongResponse.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateSongResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateSongResponse copyWith(void Function(UpdateSongResponse) updates) =>
      super.copyWith((message) => updates(message as UpdateSongResponse))
          as UpdateSongResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UpdateSongResponse() / UpdateSongResponse.new instead')
  static UpdateSongResponse create() => UpdateSongResponse._();
  static $pb.GeneratedMessage $_createMessage() => UpdateSongResponse._();
  @$core.override
  UpdateSongResponse createEmptyInstance() => UpdateSongResponse._();
  @$core.pragma('dart2js:noInline')
  static UpdateSongResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateSongResponse>(
          UpdateSongResponse.$_createMessage);
  static UpdateSongResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.Song get song => $_getN(0);
  @$pb.TagNumber(1)
  set song($0.Song value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasSong() => $_has(0);
  @$pb.TagNumber(1)
  void clearSong() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.Song ensureSong() => $_ensure(0);
}

/// The song to delete.
class DeleteSongRequest extends $pb.GeneratedMessage {
  factory DeleteSongRequest({
    $core.String? number,
    $core.bool? keepFile,
  }) {
    final result = DeleteSongRequest._();
    if (number != null) result.number = number;
    if (keepFile != null) result.keepFile = keepFile;
    return result;
  }

  DeleteSongRequest._();

  factory DeleteSongRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteSongRequest()..mergeFromBuffer(data, registry);
  factory DeleteSongRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteSongRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeleteSongRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeleteSongRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aOB(2, _omitFieldNames ? '' : 'keepFile')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteSongRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteSongRequest copyWith(void Function(DeleteSongRequest) updates) =>
      super.copyWith((message) => updates(message as DeleteSongRequest))
          as DeleteSongRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use DeleteSongRequest() / DeleteSongRequest.new instead')
  static DeleteSongRequest create() => DeleteSongRequest._();
  static $pb.GeneratedMessage $_createMessage() => DeleteSongRequest._();
  @$core.override
  DeleteSongRequest createEmptyInstance() => DeleteSongRequest._();
  @$core.pragma('dart2js:noInline')
  static DeleteSongRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<DeleteSongRequest>(
          DeleteSongRequest.$_createMessage);
  static DeleteSongRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  /// Only take the song off the list; the file stays where it is. False (the default) deletes the file too.
  @$pb.TagNumber(2)
  $core.bool get keepFile => $_getBF(1);
  @$pb.TagNumber(2)
  set keepFile($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasKeepFile() => $_has(1);
  @$pb.TagNumber(2)
  void clearKeepFile() => $_clearField(2);
}

/// What to remove from the list.
class RemoveSongsRequest extends $pb.GeneratedMessage {
  factory RemoveSongsRequest({
    RemoveScope? scope,
    $core.bool? deleteFiles,
  }) {
    final result = RemoveSongsRequest._();
    if (scope != null) result.scope = scope;
    if (deleteFiles != null) result.deleteFiles = deleteFiles;
    return result;
  }

  RemoveSongsRequest._();

  factory RemoveSongsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSongsRequest()..mergeFromBuffer(data, registry);
  factory RemoveSongsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSongsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RemoveSongsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RemoveSongsRequest.$_createMessage)
    ..aE<RemoveScope>(1, _omitFieldNames ? '' : 'scope',
        enumValues: RemoveScope.values)
    ..aOB(2, _omitFieldNames ? '' : 'deleteFiles')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSongsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSongsRequest copyWith(void Function(RemoveSongsRequest) updates) =>
      super.copyWith((message) => updates(message as RemoveSongsRequest))
          as RemoveSongsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use RemoveSongsRequest() / RemoveSongsRequest.new instead')
  static RemoveSongsRequest create() => RemoveSongsRequest._();
  static $pb.GeneratedMessage $_createMessage() => RemoveSongsRequest._();
  @$core.override
  RemoveSongsRequest createEmptyInstance() => RemoveSongsRequest._();
  @$core.pragma('dart2js:noInline')
  static RemoveSongsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RemoveSongsRequest>(
          RemoveSongsRequest.$_createMessage);
  static RemoveSongsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  RemoveScope get scope => $_getN(0);
  @$pb.TagNumber(1)
  set scope(RemoveScope value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasScope() => $_has(0);
  @$pb.TagNumber(1)
  void clearScope() => $_clearField(1);

  /// Also delete the song files (only inside the data and library folders).
  @$pb.TagNumber(2)
  $core.bool get deleteFiles => $_getBF(1);
  @$pb.TagNumber(2)
  set deleteFiles($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasDeleteFiles() => $_has(1);
  @$pb.TagNumber(2)
  void clearDeleteFiles() => $_clearField(2);
}

/// The songs the admin chose to remove.
class RemoveSelectedSongsRequest extends $pb.GeneratedMessage {
  factory RemoveSelectedSongsRequest({
    $core.Iterable<$core.String>? numbers,
    $core.bool? deleteFiles,
  }) {
    final result = RemoveSelectedSongsRequest._();
    if (numbers != null) result.numbers.addAll(numbers);
    if (deleteFiles != null) result.deleteFiles = deleteFiles;
    return result;
  }

  RemoveSelectedSongsRequest._();

  factory RemoveSelectedSongsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSelectedSongsRequest()..mergeFromBuffer(data, registry);
  factory RemoveSelectedSongsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSelectedSongsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RemoveSelectedSongsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RemoveSelectedSongsRequest.$_createMessage)
    ..pPS(1, _omitFieldNames ? '' : 'numbers')
    ..aOB(2, _omitFieldNames ? '' : 'deleteFiles')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSelectedSongsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSelectedSongsRequest copyWith(
          void Function(RemoveSelectedSongsRequest) updates) =>
      super.copyWith(
              (message) => updates(message as RemoveSelectedSongsRequest))
          as RemoveSelectedSongsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RemoveSelectedSongsRequest() / RemoveSelectedSongsRequest.new instead')
  static RemoveSelectedSongsRequest create() => RemoveSelectedSongsRequest._();
  static $pb.GeneratedMessage $_createMessage() =>
      RemoveSelectedSongsRequest._();
  @$core.override
  RemoveSelectedSongsRequest createEmptyInstance() =>
      RemoveSelectedSongsRequest._();
  @$core.pragma('dart2js:noInline')
  static RemoveSelectedSongsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RemoveSelectedSongsRequest>(
          RemoveSelectedSongsRequest.$_createMessage);
  static RemoveSelectedSongsRequest? _defaultInstance;

  /// The numbers of the songs: 1 to 1000, each of at least 5 digits.
  @$pb.TagNumber(1)
  $pb.PbList<$core.String> get numbers => $_getList(0);

  /// Also delete the song files (only inside the data and library folders; the others are counted in files_failed of the answer).
  @$pb.TagNumber(2)
  $core.bool get deleteFiles => $_getBF(1);
  @$pb.TagNumber(2)
  set deleteFiles($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasDeleteFiles() => $_has(1);
  @$pb.TagNumber(2)
  void clearDeleteFiles() => $_clearField(2);
}

/// How many of the chosen songs left the list, and what happened to their files (with delete_files).
class RemoveSelectedSongsResponse extends $pb.GeneratedMessage {
  factory RemoveSelectedSongsResponse({
    $core.int? removed,
    $core.int? filesDeleted,
    $core.int? filesFailed,
  }) {
    final result = RemoveSelectedSongsResponse._();
    if (removed != null) result.removed = removed;
    if (filesDeleted != null) result.filesDeleted = filesDeleted;
    if (filesFailed != null) result.filesFailed = filesFailed;
    return result;
  }

  RemoveSelectedSongsResponse._();

  factory RemoveSelectedSongsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSelectedSongsResponse()..mergeFromBuffer(data, registry);
  factory RemoveSelectedSongsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSelectedSongsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RemoveSelectedSongsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RemoveSelectedSongsResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'removed')
    ..aI(2, _omitFieldNames ? '' : 'filesDeleted')
    ..aI(3, _omitFieldNames ? '' : 'filesFailed')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSelectedSongsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSelectedSongsResponse copyWith(
          void Function(RemoveSelectedSongsResponse) updates) =>
      super.copyWith(
              (message) => updates(message as RemoveSelectedSongsResponse))
          as RemoveSelectedSongsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RemoveSelectedSongsResponse() / RemoveSelectedSongsResponse.new instead')
  static RemoveSelectedSongsResponse create() =>
      RemoveSelectedSongsResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      RemoveSelectedSongsResponse._();
  @$core.override
  RemoveSelectedSongsResponse createEmptyInstance() =>
      RemoveSelectedSongsResponse._();
  @$core.pragma('dart2js:noInline')
  static RemoveSelectedSongsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RemoveSelectedSongsResponse>(
          RemoveSelectedSongsResponse.$_createMessage);
  static RemoveSelectedSongsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get removed => $_getIZ(0);
  @$pb.TagNumber(1)
  set removed($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasRemoved() => $_has(0);
  @$pb.TagNumber(1)
  void clearRemoved() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get filesDeleted => $_getIZ(1);
  @$pb.TagNumber(2)
  set filesDeleted($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasFilesDeleted() => $_has(1);
  @$pb.TagNumber(2)
  void clearFilesDeleted() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get filesFailed => $_getIZ(2);
  @$pb.TagNumber(3)
  set filesFailed($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasFilesFailed() => $_has(2);
  @$pb.TagNumber(3)
  void clearFilesFailed() => $_clearField(3);
}

/// How many songs left the list.
class RemoveSongsResponse extends $pb.GeneratedMessage {
  factory RemoveSongsResponse({
    $core.int? removed,
    $core.int? filesDeleted,
    $core.int? filesFailed,
  }) {
    final result = RemoveSongsResponse._();
    if (removed != null) result.removed = removed;
    if (filesDeleted != null) result.filesDeleted = filesDeleted;
    if (filesFailed != null) result.filesFailed = filesFailed;
    return result;
  }

  RemoveSongsResponse._();

  factory RemoveSongsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSongsResponse()..mergeFromBuffer(data, registry);
  factory RemoveSongsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveSongsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RemoveSongsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RemoveSongsResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'removed')
    ..aI(2, _omitFieldNames ? '' : 'filesDeleted')
    ..aI(3, _omitFieldNames ? '' : 'filesFailed')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSongsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveSongsResponse copyWith(void Function(RemoveSongsResponse) updates) =>
      super.copyWith((message) => updates(message as RemoveSongsResponse))
          as RemoveSongsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use RemoveSongsResponse() / RemoveSongsResponse.new instead')
  static RemoveSongsResponse create() => RemoveSongsResponse._();
  static $pb.GeneratedMessage $_createMessage() => RemoveSongsResponse._();
  @$core.override
  RemoveSongsResponse createEmptyInstance() => RemoveSongsResponse._();
  @$core.pragma('dart2js:noInline')
  static RemoveSongsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RemoveSongsResponse>(
          RemoveSongsResponse.$_createMessage);
  static RemoveSongsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get removed => $_getIZ(0);
  @$pb.TagNumber(1)
  set removed($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasRemoved() => $_has(0);
  @$pb.TagNumber(1)
  void clearRemoved() => $_clearField(1);

  /// With delete_files: the files that were deleted, and the files that were not (outside the managed folders, or in use); the
  /// songs of the latter are off the list all the same.
  @$pb.TagNumber(2)
  $core.int get filesDeleted => $_getIZ(1);
  @$pb.TagNumber(2)
  set filesDeleted($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasFilesDeleted() => $_has(1);
  @$pb.TagNumber(2)
  void clearFilesDeleted() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get filesFailed => $_getIZ(2);
  @$pb.TagNumber(3)
  set filesFailed($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasFilesFailed() => $_has(2);
  @$pb.TagNumber(3)
  void clearFilesFailed() => $_clearField(3);
}

/// Asks nothing.
class CheckLibraryRequest extends $pb.GeneratedMessage {
  factory CheckLibraryRequest() => CheckLibraryRequest._();

  CheckLibraryRequest._();

  factory CheckLibraryRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CheckLibraryRequest()..mergeFromBuffer(data, registry);
  factory CheckLibraryRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CheckLibraryRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CheckLibraryRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CheckLibraryRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CheckLibraryRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CheckLibraryRequest copyWith(void Function(CheckLibraryRequest) updates) =>
      super.copyWith((message) => updates(message as CheckLibraryRequest))
          as CheckLibraryRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use CheckLibraryRequest() / CheckLibraryRequest.new instead')
  static CheckLibraryRequest create() => CheckLibraryRequest._();
  static $pb.GeneratedMessage $_createMessage() => CheckLibraryRequest._();
  @$core.override
  CheckLibraryRequest createEmptyInstance() => CheckLibraryRequest._();
  @$core.pragma('dart2js:noInline')
  static CheckLibraryRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CheckLibraryRequest>(
          CheckLibraryRequest.$_createMessage);
  static CheckLibraryRequest? _defaultInstance;
}

/// Where the check is; every 250 songs and at the end (done = true).
class CheckLibraryResponse extends $pb.GeneratedMessage {
  factory CheckLibraryResponse({
    $core.int? checked,
    $core.int? total,
    $core.int? broken,
    $core.bool? done,
  }) {
    final result = CheckLibraryResponse._();
    if (checked != null) result.checked = checked;
    if (total != null) result.total = total;
    if (broken != null) result.broken = broken;
    if (done != null) result.done = done;
    return result;
  }

  CheckLibraryResponse._();

  factory CheckLibraryResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CheckLibraryResponse()..mergeFromBuffer(data, registry);
  factory CheckLibraryResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CheckLibraryResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CheckLibraryResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CheckLibraryResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'checked')
    ..aI(2, _omitFieldNames ? '' : 'total')
    ..aI(3, _omitFieldNames ? '' : 'broken')
    ..aOB(4, _omitFieldNames ? '' : 'done')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CheckLibraryResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CheckLibraryResponse copyWith(void Function(CheckLibraryResponse) updates) =>
      super.copyWith((message) => updates(message as CheckLibraryResponse))
          as CheckLibraryResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use CheckLibraryResponse() / CheckLibraryResponse.new instead')
  static CheckLibraryResponse create() => CheckLibraryResponse._();
  static $pb.GeneratedMessage $_createMessage() => CheckLibraryResponse._();
  @$core.override
  CheckLibraryResponse createEmptyInstance() => CheckLibraryResponse._();
  @$core.pragma('dart2js:noInline')
  static CheckLibraryResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CheckLibraryResponse>(
          CheckLibraryResponse.$_createMessage);
  static CheckLibraryResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get checked => $_getIZ(0);
  @$pb.TagNumber(1)
  set checked($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasChecked() => $_has(0);
  @$pb.TagNumber(1)
  void clearChecked() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get total => $_getIZ(1);
  @$pb.TagNumber(2)
  set total($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasTotal() => $_has(1);
  @$pb.TagNumber(2)
  void clearTotal() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get broken => $_getIZ(2);
  @$pb.TagNumber(3)
  set broken($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasBroken() => $_has(2);
  @$pb.TagNumber(3)
  void clearBroken() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get done => $_getBF(3);
  @$pb.TagNumber(4)
  set done($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasDone() => $_has(3);
  @$pb.TagNumber(4)
  void clearDone() => $_clearField(4);
}

/// One page of broken songs.
class ListBrokenSongsRequest extends $pb.GeneratedMessage {
  factory ListBrokenSongsRequest({
    $core.String? pageToken,
    $core.int? pageSize,
  }) {
    final result = ListBrokenSongsRequest._();
    if (pageToken != null) result.pageToken = pageToken;
    if (pageSize != null) result.pageSize = pageSize;
    return result;
  }

  ListBrokenSongsRequest._();

  factory ListBrokenSongsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListBrokenSongsRequest()..mergeFromBuffer(data, registry);
  factory ListBrokenSongsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListBrokenSongsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListBrokenSongsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListBrokenSongsRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'pageToken')
    ..aI(2, _omitFieldNames ? '' : 'pageSize')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListBrokenSongsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListBrokenSongsRequest copyWith(
          void Function(ListBrokenSongsRequest) updates) =>
      super.copyWith((message) => updates(message as ListBrokenSongsRequest))
          as ListBrokenSongsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListBrokenSongsRequest() / ListBrokenSongsRequest.new instead')
  static ListBrokenSongsRequest create() => ListBrokenSongsRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListBrokenSongsRequest._();
  @$core.override
  ListBrokenSongsRequest createEmptyInstance() => ListBrokenSongsRequest._();
  @$core.pragma('dart2js:noInline')
  static ListBrokenSongsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListBrokenSongsRequest>(
          ListBrokenSongsRequest.$_createMessage);
  static ListBrokenSongsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get pageToken => $_getSZ(0);
  @$pb.TagNumber(1)
  set pageToken($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasPageToken() => $_has(0);
  @$pb.TagNumber(1)
  void clearPageToken() => $_clearField(1);

  /// Defaults to 50.
  @$pb.TagNumber(2)
  $core.int get pageSize => $_getIZ(1);
  @$pb.TagNumber(2)
  set pageSize($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPageSize() => $_has(1);
  @$pb.TagNumber(2)
  void clearPageSize() => $_clearField(2);
}

/// A song that cannot be played and why.
class BrokenSong extends $pb.GeneratedMessage {
  factory BrokenSong({
    $0.Song? song,
    $core.String? reason,
  }) {
    final result = BrokenSong._();
    if (song != null) result.song = song;
    if (reason != null) result.reason = reason;
    return result;
  }

  BrokenSong._();

  factory BrokenSong.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      BrokenSong()..mergeFromBuffer(data, registry);
  factory BrokenSong.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      BrokenSong()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'BrokenSong',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: BrokenSong.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..aOS(2, _omitFieldNames ? '' : 'reason')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  BrokenSong clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  BrokenSong copyWith(void Function(BrokenSong) updates) =>
      super.copyWith((message) => updates(message as BrokenSong)) as BrokenSong;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use BrokenSong() / BrokenSong.new instead')
  static BrokenSong create() => BrokenSong._();
  static $pb.GeneratedMessage $_createMessage() => BrokenSong._();
  @$core.override
  BrokenSong createEmptyInstance() => BrokenSong._();
  @$core.pragma('dart2js:noInline')
  static BrokenSong getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<BrokenSong>(BrokenSong.$_createMessage);
  static BrokenSong? _defaultInstance;

  @$pb.TagNumber(1)
  $0.Song get song => $_getN(0);
  @$pb.TagNumber(1)
  set song($0.Song value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasSong() => $_has(0);
  @$pb.TagNumber(1)
  void clearSong() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.Song ensureSong() => $_ensure(0);

  /// For people: "the file is missing", "the file contains no music", ...
  @$pb.TagNumber(2)
  $core.String get reason => $_getSZ(1);
  @$pb.TagNumber(2)
  set reason($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasReason() => $_has(1);
  @$pb.TagNumber(2)
  void clearReason() => $_clearField(2);
}

/// The page, and how many broken songs there are in all.
class ListBrokenSongsResponse extends $pb.GeneratedMessage {
  factory ListBrokenSongsResponse({
    $core.Iterable<BrokenSong>? songs,
    $core.String? nextPageToken,
    $core.int? total,
  }) {
    final result = ListBrokenSongsResponse._();
    if (songs != null) result.songs.addAll(songs);
    if (nextPageToken != null) result.nextPageToken = nextPageToken;
    if (total != null) result.total = total;
    return result;
  }

  ListBrokenSongsResponse._();

  factory ListBrokenSongsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListBrokenSongsResponse()..mergeFromBuffer(data, registry);
  factory ListBrokenSongsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListBrokenSongsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListBrokenSongsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListBrokenSongsResponse.$_createMessage)
    ..pPM<BrokenSong>(1, _omitFieldNames ? '' : 'songs',
        subBuilder: BrokenSong.$_createMessage)
    ..aOS(2, _omitFieldNames ? '' : 'nextPageToken')
    ..aI(3, _omitFieldNames ? '' : 'total')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListBrokenSongsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListBrokenSongsResponse copyWith(
          void Function(ListBrokenSongsResponse) updates) =>
      super.copyWith((message) => updates(message as ListBrokenSongsResponse))
          as ListBrokenSongsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListBrokenSongsResponse() / ListBrokenSongsResponse.new instead')
  static ListBrokenSongsResponse create() => ListBrokenSongsResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListBrokenSongsResponse._();
  @$core.override
  ListBrokenSongsResponse createEmptyInstance() => ListBrokenSongsResponse._();
  @$core.pragma('dart2js:noInline')
  static ListBrokenSongsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListBrokenSongsResponse>(
          ListBrokenSongsResponse.$_createMessage);
  static ListBrokenSongsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<BrokenSong> get songs => $_getList(0);

  @$pb.TagNumber(2)
  $core.String get nextPageToken => $_getSZ(1);
  @$pb.TagNumber(2)
  set nextPageToken($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasNextPageToken() => $_has(1);
  @$pb.TagNumber(2)
  void clearNextPageToken() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get total => $_getIZ(2);
  @$pb.TagNumber(3)
  set total($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasTotal() => $_has(2);
  @$pb.TagNumber(3)
  void clearTotal() => $_clearField(3);
}

/// Empty.
class DeleteSongResponse extends $pb.GeneratedMessage {
  factory DeleteSongResponse() => DeleteSongResponse._();

  DeleteSongResponse._();

  factory DeleteSongResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteSongResponse()..mergeFromBuffer(data, registry);
  factory DeleteSongResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteSongResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeleteSongResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeleteSongResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteSongResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteSongResponse copyWith(void Function(DeleteSongResponse) updates) =>
      super.copyWith((message) => updates(message as DeleteSongResponse))
          as DeleteSongResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use DeleteSongResponse() / DeleteSongResponse.new instead')
  static DeleteSongResponse create() => DeleteSongResponse._();
  static $pb.GeneratedMessage $_createMessage() => DeleteSongResponse._();
  @$core.override
  DeleteSongResponse createEmptyInstance() => DeleteSongResponse._();
  @$core.pragma('dart2js:noInline')
  static DeleteSongResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeleteSongResponse>(
          DeleteSongResponse.$_createMessage);
  static DeleteSongResponse? _defaultInstance;
}

/// Asks nothing.
class RescanRequest extends $pb.GeneratedMessage {
  factory RescanRequest() => RescanRequest._();

  RescanRequest._();

  factory RescanRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RescanRequest()..mergeFromBuffer(data, registry);
  factory RescanRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RescanRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RescanRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RescanRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RescanRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RescanRequest copyWith(void Function(RescanRequest) updates) =>
      super.copyWith((message) => updates(message as RescanRequest))
          as RescanRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use RescanRequest() / RescanRequest.new instead')
  static RescanRequest create() => RescanRequest._();
  static $pb.GeneratedMessage $_createMessage() => RescanRequest._();
  @$core.override
  RescanRequest createEmptyInstance() => RescanRequest._();
  @$core.pragma('dart2js:noInline')
  static RescanRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<RescanRequest>(
          RescanRequest.$_createMessage);
  static RescanRequest? _defaultInstance;
}

/// Counts from the scan.
class RescanResponse extends $pb.GeneratedMessage {
  factory RescanResponse({
    $core.int? added,
    $core.int? updated,
    $core.int? removed,
    $core.int? failed,
  }) {
    final result = RescanResponse._();
    if (added != null) result.added = added;
    if (updated != null) result.updated = updated;
    if (removed != null) result.removed = removed;
    if (failed != null) result.failed = failed;
    return result;
  }

  RescanResponse._();

  factory RescanResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RescanResponse()..mergeFromBuffer(data, registry);
  factory RescanResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RescanResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RescanResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RescanResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'added')
    ..aI(2, _omitFieldNames ? '' : 'updated')
    ..aI(3, _omitFieldNames ? '' : 'removed')
    ..aI(4, _omitFieldNames ? '' : 'failed')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RescanResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RescanResponse copyWith(void Function(RescanResponse) updates) =>
      super.copyWith((message) => updates(message as RescanResponse))
          as RescanResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use RescanResponse() / RescanResponse.new instead')
  static RescanResponse create() => RescanResponse._();
  static $pb.GeneratedMessage $_createMessage() => RescanResponse._();
  @$core.override
  RescanResponse createEmptyInstance() => RescanResponse._();
  @$core.pragma('dart2js:noInline')
  static RescanResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<RescanResponse>(
          RescanResponse.$_createMessage);
  static RescanResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get added => $_getIZ(0);
  @$pb.TagNumber(1)
  set added($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasAdded() => $_has(0);
  @$pb.TagNumber(1)
  void clearAdded() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get updated => $_getIZ(1);
  @$pb.TagNumber(2)
  set updated($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasUpdated() => $_has(1);
  @$pb.TagNumber(2)
  void clearUpdated() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get removed => $_getIZ(2);
  @$pb.TagNumber(3)
  set removed($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasRemoved() => $_has(2);
  @$pb.TagNumber(3)
  void clearRemoved() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.int get failed => $_getIZ(3);
  @$pb.TagNumber(4)
  set failed($core.int value) => $_setSignedInt32(3, value);
  @$pb.TagNumber(4)
  $core.bool hasFailed() => $_has(3);
  @$pb.TagNumber(4)
  void clearFailed() => $_clearField(4);
}

/// Asks nothing.
class GetServerSettingsRequest extends $pb.GeneratedMessage {
  factory GetServerSettingsRequest() => GetServerSettingsRequest._();

  GetServerSettingsRequest._();

  factory GetServerSettingsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerSettingsRequest()..mergeFromBuffer(data, registry);
  factory GetServerSettingsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerSettingsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetServerSettingsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetServerSettingsRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerSettingsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerSettingsRequest copyWith(
          void Function(GetServerSettingsRequest) updates) =>
      super.copyWith((message) => updates(message as GetServerSettingsRequest))
          as GetServerSettingsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetServerSettingsRequest() / GetServerSettingsRequest.new instead')
  static GetServerSettingsRequest create() => GetServerSettingsRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetServerSettingsRequest._();
  @$core.override
  GetServerSettingsRequest createEmptyInstance() =>
      GetServerSettingsRequest._();
  @$core.pragma('dart2js:noInline')
  static GetServerSettingsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetServerSettingsRequest>(
          GetServerSettingsRequest.$_createMessage);
  static GetServerSettingsRequest? _defaultInstance;
}

/// The current settings.
class GetServerSettingsResponse extends $pb.GeneratedMessage {
  factory GetServerSettingsResponse({
    ServerSettings? settings,
  }) {
    final result = GetServerSettingsResponse._();
    if (settings != null) result.settings = settings;
    return result;
  }

  GetServerSettingsResponse._();

  factory GetServerSettingsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerSettingsResponse()..mergeFromBuffer(data, registry);
  factory GetServerSettingsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetServerSettingsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetServerSettingsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetServerSettingsResponse.$_createMessage)
    ..aOM<ServerSettings>(1, _omitFieldNames ? '' : 'settings',
        subBuilder: ServerSettings.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerSettingsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetServerSettingsResponse copyWith(
          void Function(GetServerSettingsResponse) updates) =>
      super.copyWith((message) => updates(message as GetServerSettingsResponse))
          as GetServerSettingsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetServerSettingsResponse() / GetServerSettingsResponse.new instead')
  static GetServerSettingsResponse create() => GetServerSettingsResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      GetServerSettingsResponse._();
  @$core.override
  GetServerSettingsResponse createEmptyInstance() =>
      GetServerSettingsResponse._();
  @$core.pragma('dart2js:noInline')
  static GetServerSettingsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetServerSettingsResponse>(
          GetServerSettingsResponse.$_createMessage);
  static GetServerSettingsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  ServerSettings get settings => $_getN(0);
  @$pb.TagNumber(1)
  set settings(ServerSettings value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasSettings() => $_has(0);
  @$pb.TagNumber(1)
  void clearSettings() => $_clearField(1);
  @$pb.TagNumber(1)
  ServerSettings ensureSettings() => $_ensure(0);
}

/// Server-wide limits and switches: upload size per song, how long the score screen shows, the size limit of one background video and
/// whether the players show the background videos (in the order set, or shuffled on every pass).
class ServerSettings extends $pb.GeneratedMessage {
  factory ServerSettings({
    $fixnum.Int64? maxUploadBytes,
    $core.int? scoreSeconds,
    $fixnum.Int64? maxVideoBytes,
    $core.bool? backgroundEnabled,
    $core.bool? backgroundShuffle,
  }) {
    final result = ServerSettings._();
    if (maxUploadBytes != null) result.maxUploadBytes = maxUploadBytes;
    if (scoreSeconds != null) result.scoreSeconds = scoreSeconds;
    if (maxVideoBytes != null) result.maxVideoBytes = maxVideoBytes;
    if (backgroundEnabled != null) result.backgroundEnabled = backgroundEnabled;
    if (backgroundShuffle != null) result.backgroundShuffle = backgroundShuffle;
    return result;
  }

  ServerSettings._();

  factory ServerSettings.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ServerSettings()..mergeFromBuffer(data, registry);
  factory ServerSettings.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ServerSettings()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ServerSettings',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ServerSettings.$_createMessage)
    ..aInt64(1, _omitFieldNames ? '' : 'maxUploadBytes')
    ..aI(2, _omitFieldNames ? '' : 'scoreSeconds')
    ..aInt64(3, _omitFieldNames ? '' : 'maxVideoBytes')
    ..aOB(4, _omitFieldNames ? '' : 'backgroundEnabled')
    ..aOB(5, _omitFieldNames ? '' : 'backgroundShuffle')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ServerSettings clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ServerSettings copyWith(void Function(ServerSettings) updates) =>
      super.copyWith((message) => updates(message as ServerSettings))
          as ServerSettings;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ServerSettings() / ServerSettings.new instead')
  static ServerSettings create() => ServerSettings._();
  static $pb.GeneratedMessage $_createMessage() => ServerSettings._();
  @$core.override
  ServerSettings createEmptyInstance() => ServerSettings._();
  @$core.pragma('dart2js:noInline')
  static ServerSettings getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ServerSettings>(
          ServerSettings.$_createMessage);
  static ServerSettings? _defaultInstance;

  @$pb.TagNumber(1)
  $fixnum.Int64 get maxUploadBytes => $_getI64(0);
  @$pb.TagNumber(1)
  set maxUploadBytes($fixnum.Int64 value) => $_setInt64(0, value);
  @$pb.TagNumber(1)
  $core.bool hasMaxUploadBytes() => $_has(0);
  @$pb.TagNumber(1)
  void clearMaxUploadBytes() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get scoreSeconds => $_getIZ(1);
  @$pb.TagNumber(2)
  set scoreSeconds($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasScoreSeconds() => $_has(1);
  @$pb.TagNumber(2)
  void clearScoreSeconds() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get maxVideoBytes => $_getI64(2);
  @$pb.TagNumber(3)
  set maxVideoBytes($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasMaxVideoBytes() => $_has(2);
  @$pb.TagNumber(3)
  void clearMaxVideoBytes() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get backgroundEnabled => $_getBF(3);
  @$pb.TagNumber(4)
  set backgroundEnabled($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasBackgroundEnabled() => $_has(3);
  @$pb.TagNumber(4)
  void clearBackgroundEnabled() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get backgroundShuffle => $_getBF(4);
  @$pb.TagNumber(5)
  set backgroundShuffle($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasBackgroundShuffle() => $_has(4);
  @$pb.TagNumber(5)
  void clearBackgroundShuffle() => $_clearField(5);
}

/// Partial update of the server settings.
class UpdateServerSettingsRequest extends $pb.GeneratedMessage {
  factory UpdateServerSettingsRequest({
    $fixnum.Int64? maxUploadBytes,
    $core.int? scoreSeconds,
    $fixnum.Int64? maxVideoBytes,
    $core.bool? backgroundEnabled,
    $core.bool? backgroundShuffle,
  }) {
    final result = UpdateServerSettingsRequest._();
    if (maxUploadBytes != null) result.maxUploadBytes = maxUploadBytes;
    if (scoreSeconds != null) result.scoreSeconds = scoreSeconds;
    if (maxVideoBytes != null) result.maxVideoBytes = maxVideoBytes;
    if (backgroundEnabled != null) result.backgroundEnabled = backgroundEnabled;
    if (backgroundShuffle != null) result.backgroundShuffle = backgroundShuffle;
    return result;
  }

  UpdateServerSettingsRequest._();

  factory UpdateServerSettingsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateServerSettingsRequest()..mergeFromBuffer(data, registry);
  factory UpdateServerSettingsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateServerSettingsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateServerSettingsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateServerSettingsRequest.$_createMessage)
    ..aInt64(1, _omitFieldNames ? '' : 'maxUploadBytes')
    ..aI(2, _omitFieldNames ? '' : 'scoreSeconds')
    ..aInt64(3, _omitFieldNames ? '' : 'maxVideoBytes')
    ..aOB(4, _omitFieldNames ? '' : 'backgroundEnabled')
    ..aOB(5, _omitFieldNames ? '' : 'backgroundShuffle')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateServerSettingsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateServerSettingsRequest copyWith(
          void Function(UpdateServerSettingsRequest) updates) =>
      super.copyWith(
              (message) => updates(message as UpdateServerSettingsRequest))
          as UpdateServerSettingsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UpdateServerSettingsRequest() / UpdateServerSettingsRequest.new instead')
  static UpdateServerSettingsRequest create() =>
      UpdateServerSettingsRequest._();
  static $pb.GeneratedMessage $_createMessage() =>
      UpdateServerSettingsRequest._();
  @$core.override
  UpdateServerSettingsRequest createEmptyInstance() =>
      UpdateServerSettingsRequest._();
  @$core.pragma('dart2js:noInline')
  static UpdateServerSettingsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateServerSettingsRequest>(
          UpdateServerSettingsRequest.$_createMessage);
  static UpdateServerSettingsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $fixnum.Int64 get maxUploadBytes => $_getI64(0);
  @$pb.TagNumber(1)
  set maxUploadBytes($fixnum.Int64 value) => $_setInt64(0, value);
  @$pb.TagNumber(1)
  $core.bool hasMaxUploadBytes() => $_has(0);
  @$pb.TagNumber(1)
  void clearMaxUploadBytes() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get scoreSeconds => $_getIZ(1);
  @$pb.TagNumber(2)
  set scoreSeconds($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasScoreSeconds() => $_has(1);
  @$pb.TagNumber(2)
  void clearScoreSeconds() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get maxVideoBytes => $_getI64(2);
  @$pb.TagNumber(3)
  set maxVideoBytes($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasMaxVideoBytes() => $_has(2);
  @$pb.TagNumber(3)
  void clearMaxVideoBytes() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get backgroundEnabled => $_getBF(3);
  @$pb.TagNumber(4)
  set backgroundEnabled($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasBackgroundEnabled() => $_has(3);
  @$pb.TagNumber(4)
  void clearBackgroundEnabled() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get backgroundShuffle => $_getBF(4);
  @$pb.TagNumber(5)
  set backgroundShuffle($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasBackgroundShuffle() => $_has(4);
  @$pb.TagNumber(5)
  void clearBackgroundShuffle() => $_clearField(5);
}

/// The settings after the update.
class UpdateServerSettingsResponse extends $pb.GeneratedMessage {
  factory UpdateServerSettingsResponse({
    ServerSettings? settings,
  }) {
    final result = UpdateServerSettingsResponse._();
    if (settings != null) result.settings = settings;
    return result;
  }

  UpdateServerSettingsResponse._();

  factory UpdateServerSettingsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateServerSettingsResponse()..mergeFromBuffer(data, registry);
  factory UpdateServerSettingsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateServerSettingsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateServerSettingsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateServerSettingsResponse.$_createMessage)
    ..aOM<ServerSettings>(1, _omitFieldNames ? '' : 'settings',
        subBuilder: ServerSettings.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateServerSettingsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateServerSettingsResponse copyWith(
          void Function(UpdateServerSettingsResponse) updates) =>
      super.copyWith(
              (message) => updates(message as UpdateServerSettingsResponse))
          as UpdateServerSettingsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UpdateServerSettingsResponse() / UpdateServerSettingsResponse.new instead')
  static UpdateServerSettingsResponse create() =>
      UpdateServerSettingsResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      UpdateServerSettingsResponse._();
  @$core.override
  UpdateServerSettingsResponse createEmptyInstance() =>
      UpdateServerSettingsResponse._();
  @$core.pragma('dart2js:noInline')
  static UpdateServerSettingsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateServerSettingsResponse>(
          UpdateServerSettingsResponse.$_createMessage);
  static UpdateServerSettingsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  ServerSettings get settings => $_getN(0);
  @$pb.TagNumber(1)
  set settings(ServerSettings value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasSettings() => $_has(0);
  @$pb.TagNumber(1)
  void clearSettings() => $_clearField(1);
  @$pb.TagNumber(1)
  ServerSettings ensureSettings() => $_ensure(0);
}

/// Asks nothing.
class ListVideosRequest extends $pb.GeneratedMessage {
  factory ListVideosRequest() => ListVideosRequest._();

  ListVideosRequest._();

  factory ListVideosRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListVideosRequest()..mergeFromBuffer(data, registry);
  factory ListVideosRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListVideosRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListVideosRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListVideosRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListVideosRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListVideosRequest copyWith(void Function(ListVideosRequest) updates) =>
      super.copyWith((message) => updates(message as ListVideosRequest))
          as ListVideosRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ListVideosRequest() / ListVideosRequest.new instead')
  static ListVideosRequest create() => ListVideosRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListVideosRequest._();
  @$core.override
  ListVideosRequest createEmptyInstance() => ListVideosRequest._();
  @$core.pragma('dart2js:noInline')
  static ListVideosRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ListVideosRequest>(
          ListVideosRequest.$_createMessage);
  static ListVideosRequest? _defaultInstance;
}

/// Every video, in loop order.
class ListVideosResponse extends $pb.GeneratedMessage {
  factory ListVideosResponse({
    $core.Iterable<$0.Video>? videos,
  }) {
    final result = ListVideosResponse._();
    if (videos != null) result.videos.addAll(videos);
    return result;
  }

  ListVideosResponse._();

  factory ListVideosResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListVideosResponse()..mergeFromBuffer(data, registry);
  factory ListVideosResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListVideosResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListVideosResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListVideosResponse.$_createMessage)
    ..pPM<$0.Video>(1, _omitFieldNames ? '' : 'videos',
        subBuilder: $0.Video.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListVideosResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListVideosResponse copyWith(void Function(ListVideosResponse) updates) =>
      super.copyWith((message) => updates(message as ListVideosResponse))
          as ListVideosResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ListVideosResponse() / ListVideosResponse.new instead')
  static ListVideosResponse create() => ListVideosResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListVideosResponse._();
  @$core.override
  ListVideosResponse createEmptyInstance() => ListVideosResponse._();
  @$core.pragma('dart2js:noInline')
  static ListVideosResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListVideosResponse>(
          ListVideosResponse.$_createMessage);
  static ListVideosResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<$0.Video> get videos => $_getList(0);
}

/// The video and what to change; unset fields stay as they are.
class UpdateVideoRequest extends $pb.GeneratedMessage {
  factory UpdateVideoRequest({
    $core.String? id,
    $core.String? name,
    $core.bool? enabled,
  }) {
    final result = UpdateVideoRequest._();
    if (id != null) result.id = id;
    if (name != null) result.name = name;
    if (enabled != null) result.enabled = enabled;
    return result;
  }

  UpdateVideoRequest._();

  factory UpdateVideoRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateVideoRequest()..mergeFromBuffer(data, registry);
  factory UpdateVideoRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateVideoRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateVideoRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateVideoRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOS(2, _omitFieldNames ? '' : 'name')
    ..aOB(3, _omitFieldNames ? '' : 'enabled')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateVideoRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateVideoRequest copyWith(void Function(UpdateVideoRequest) updates) =>
      super.copyWith((message) => updates(message as UpdateVideoRequest))
          as UpdateVideoRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UpdateVideoRequest() / UpdateVideoRequest.new instead')
  static UpdateVideoRequest create() => UpdateVideoRequest._();
  static $pb.GeneratedMessage $_createMessage() => UpdateVideoRequest._();
  @$core.override
  UpdateVideoRequest createEmptyInstance() => UpdateVideoRequest._();
  @$core.pragma('dart2js:noInline')
  static UpdateVideoRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateVideoRequest>(
          UpdateVideoRequest.$_createMessage);
  static UpdateVideoRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get name => $_getSZ(1);
  @$pb.TagNumber(2)
  set name($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasName() => $_has(1);
  @$pb.TagNumber(2)
  void clearName() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.bool get enabled => $_getBF(2);
  @$pb.TagNumber(3)
  set enabled($core.bool value) => $_setBool(2, value);
  @$pb.TagNumber(3)
  $core.bool hasEnabled() => $_has(2);
  @$pb.TagNumber(3)
  void clearEnabled() => $_clearField(3);
}

/// The video after the change.
class UpdateVideoResponse extends $pb.GeneratedMessage {
  factory UpdateVideoResponse({
    $0.Video? video,
  }) {
    final result = UpdateVideoResponse._();
    if (video != null) result.video = video;
    return result;
  }

  UpdateVideoResponse._();

  factory UpdateVideoResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateVideoResponse()..mergeFromBuffer(data, registry);
  factory UpdateVideoResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateVideoResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateVideoResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateVideoResponse.$_createMessage)
    ..aOM<$0.Video>(1, _omitFieldNames ? '' : 'video',
        subBuilder: $0.Video.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateVideoResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateVideoResponse copyWith(void Function(UpdateVideoResponse) updates) =>
      super.copyWith((message) => updates(message as UpdateVideoResponse))
          as UpdateVideoResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use UpdateVideoResponse() / UpdateVideoResponse.new instead')
  static UpdateVideoResponse create() => UpdateVideoResponse._();
  static $pb.GeneratedMessage $_createMessage() => UpdateVideoResponse._();
  @$core.override
  UpdateVideoResponse createEmptyInstance() => UpdateVideoResponse._();
  @$core.pragma('dart2js:noInline')
  static UpdateVideoResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateVideoResponse>(
          UpdateVideoResponse.$_createMessage);
  static UpdateVideoResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.Video get video => $_getN(0);
  @$pb.TagNumber(1)
  set video($0.Video value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasVideo() => $_has(0);
  @$pb.TagNumber(1)
  void clearVideo() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.Video ensureVideo() => $_ensure(0);
}

/// All ids, in the new loop order.
class ReorderVideosRequest extends $pb.GeneratedMessage {
  factory ReorderVideosRequest({
    $core.Iterable<$core.String>? ids,
  }) {
    final result = ReorderVideosRequest._();
    if (ids != null) result.ids.addAll(ids);
    return result;
  }

  ReorderVideosRequest._();

  factory ReorderVideosRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReorderVideosRequest()..mergeFromBuffer(data, registry);
  factory ReorderVideosRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReorderVideosRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReorderVideosRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReorderVideosRequest.$_createMessage)
    ..pPS(1, _omitFieldNames ? '' : 'ids')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReorderVideosRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReorderVideosRequest copyWith(void Function(ReorderVideosRequest) updates) =>
      super.copyWith((message) => updates(message as ReorderVideosRequest))
          as ReorderVideosRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ReorderVideosRequest() / ReorderVideosRequest.new instead')
  static ReorderVideosRequest create() => ReorderVideosRequest._();
  static $pb.GeneratedMessage $_createMessage() => ReorderVideosRequest._();
  @$core.override
  ReorderVideosRequest createEmptyInstance() => ReorderVideosRequest._();
  @$core.pragma('dart2js:noInline')
  static ReorderVideosRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ReorderVideosRequest>(
          ReorderVideosRequest.$_createMessage);
  static ReorderVideosRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<$core.String> get ids => $_getList(0);
}

/// Every video in the new order.
class ReorderVideosResponse extends $pb.GeneratedMessage {
  factory ReorderVideosResponse({
    $core.Iterable<$0.Video>? videos,
  }) {
    final result = ReorderVideosResponse._();
    if (videos != null) result.videos.addAll(videos);
    return result;
  }

  ReorderVideosResponse._();

  factory ReorderVideosResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReorderVideosResponse()..mergeFromBuffer(data, registry);
  factory ReorderVideosResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReorderVideosResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReorderVideosResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReorderVideosResponse.$_createMessage)
    ..pPM<$0.Video>(1, _omitFieldNames ? '' : 'videos',
        subBuilder: $0.Video.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReorderVideosResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReorderVideosResponse copyWith(
          void Function(ReorderVideosResponse) updates) =>
      super.copyWith((message) => updates(message as ReorderVideosResponse))
          as ReorderVideosResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ReorderVideosResponse() / ReorderVideosResponse.new instead')
  static ReorderVideosResponse create() => ReorderVideosResponse._();
  static $pb.GeneratedMessage $_createMessage() => ReorderVideosResponse._();
  @$core.override
  ReorderVideosResponse createEmptyInstance() => ReorderVideosResponse._();
  @$core.pragma('dart2js:noInline')
  static ReorderVideosResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ReorderVideosResponse>(
          ReorderVideosResponse.$_createMessage);
  static ReorderVideosResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<$0.Video> get videos => $_getList(0);
}

/// The video to remove.
class DeleteVideoRequest extends $pb.GeneratedMessage {
  factory DeleteVideoRequest({
    $core.String? id,
  }) {
    final result = DeleteVideoRequest._();
    if (id != null) result.id = id;
    return result;
  }

  DeleteVideoRequest._();

  factory DeleteVideoRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteVideoRequest()..mergeFromBuffer(data, registry);
  factory DeleteVideoRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteVideoRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeleteVideoRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeleteVideoRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteVideoRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteVideoRequest copyWith(void Function(DeleteVideoRequest) updates) =>
      super.copyWith((message) => updates(message as DeleteVideoRequest))
          as DeleteVideoRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use DeleteVideoRequest() / DeleteVideoRequest.new instead')
  static DeleteVideoRequest create() => DeleteVideoRequest._();
  static $pb.GeneratedMessage $_createMessage() => DeleteVideoRequest._();
  @$core.override
  DeleteVideoRequest createEmptyInstance() => DeleteVideoRequest._();
  @$core.pragma('dart2js:noInline')
  static DeleteVideoRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeleteVideoRequest>(
          DeleteVideoRequest.$_createMessage);
  static DeleteVideoRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);
}

/// Nothing to report.
class DeleteVideoResponse extends $pb.GeneratedMessage {
  factory DeleteVideoResponse() => DeleteVideoResponse._();

  DeleteVideoResponse._();

  factory DeleteVideoResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteVideoResponse()..mergeFromBuffer(data, registry);
  factory DeleteVideoResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeleteVideoResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeleteVideoResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeleteVideoResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteVideoResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeleteVideoResponse copyWith(void Function(DeleteVideoResponse) updates) =>
      super.copyWith((message) => updates(message as DeleteVideoResponse))
          as DeleteVideoResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use DeleteVideoResponse() / DeleteVideoResponse.new instead')
  static DeleteVideoResponse create() => DeleteVideoResponse._();
  static $pb.GeneratedMessage $_createMessage() => DeleteVideoResponse._();
  @$core.override
  DeleteVideoResponse createEmptyInstance() => DeleteVideoResponse._();
  @$core.pragma('dart2js:noInline')
  static DeleteVideoResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeleteVideoResponse>(
          DeleteVideoResponse.$_createMessage);
  static DeleteVideoResponse? _defaultInstance;
}

/// The folder to write the export into, an absolute path on the server's disk.
class ExportDataRequest extends $pb.GeneratedMessage {
  factory ExportDataRequest({
    $core.String? folder,
  }) {
    final result = ExportDataRequest._();
    if (folder != null) result.folder = folder;
    return result;
  }

  ExportDataRequest._();

  factory ExportDataRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ExportDataRequest()..mergeFromBuffer(data, registry);
  factory ExportDataRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ExportDataRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ExportDataRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ExportDataRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'folder')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ExportDataRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ExportDataRequest copyWith(void Function(ExportDataRequest) updates) =>
      super.copyWith((message) => updates(message as ExportDataRequest))
          as ExportDataRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ExportDataRequest() / ExportDataRequest.new instead')
  static ExportDataRequest create() => ExportDataRequest._();
  static $pb.GeneratedMessage $_createMessage() => ExportDataRequest._();
  @$core.override
  ExportDataRequest createEmptyInstance() => ExportDataRequest._();
  @$core.pragma('dart2js:noInline')
  static ExportDataRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ExportDataRequest>(
          ExportDataRequest.$_createMessage);
  static ExportDataRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get folder => $_getSZ(0);
  @$pb.TagNumber(1)
  set folder($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFolder() => $_has(0);
  @$pb.TagNumber(1)
  void clearFolder() => $_clearField(1);
}

/// Progress of an export; the last message has done = true.
class ExportDataResponse extends $pb.GeneratedMessage {
  factory ExportDataResponse({
    $core.int? filesDone,
    $core.int? filesTotal,
    $fixnum.Int64? bytesDone,
    $fixnum.Int64? bytesTotal,
    $core.bool? done,
    $core.Iterable<$core.String>? skippedNumbers,
    $core.String? folder,
  }) {
    final result = ExportDataResponse._();
    if (filesDone != null) result.filesDone = filesDone;
    if (filesTotal != null) result.filesTotal = filesTotal;
    if (bytesDone != null) result.bytesDone = bytesDone;
    if (bytesTotal != null) result.bytesTotal = bytesTotal;
    if (done != null) result.done = done;
    if (skippedNumbers != null) result.skippedNumbers.addAll(skippedNumbers);
    if (folder != null) result.folder = folder;
    return result;
  }

  ExportDataResponse._();

  factory ExportDataResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ExportDataResponse()..mergeFromBuffer(data, registry);
  factory ExportDataResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ExportDataResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ExportDataResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ExportDataResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'filesDone')
    ..aI(2, _omitFieldNames ? '' : 'filesTotal')
    ..aInt64(3, _omitFieldNames ? '' : 'bytesDone')
    ..aInt64(4, _omitFieldNames ? '' : 'bytesTotal')
    ..aOB(5, _omitFieldNames ? '' : 'done')
    ..pPS(6, _omitFieldNames ? '' : 'skippedNumbers')
    ..aOS(7, _omitFieldNames ? '' : 'folder')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ExportDataResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ExportDataResponse copyWith(void Function(ExportDataResponse) updates) =>
      super.copyWith((message) => updates(message as ExportDataResponse))
          as ExportDataResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ExportDataResponse() / ExportDataResponse.new instead')
  static ExportDataResponse create() => ExportDataResponse._();
  static $pb.GeneratedMessage $_createMessage() => ExportDataResponse._();
  @$core.override
  ExportDataResponse createEmptyInstance() => ExportDataResponse._();
  @$core.pragma('dart2js:noInline')
  static ExportDataResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ExportDataResponse>(
          ExportDataResponse.$_createMessage);
  static ExportDataResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get filesDone => $_getIZ(0);
  @$pb.TagNumber(1)
  set filesDone($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFilesDone() => $_has(0);
  @$pb.TagNumber(1)
  void clearFilesDone() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get filesTotal => $_getIZ(1);
  @$pb.TagNumber(2)
  set filesTotal($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasFilesTotal() => $_has(1);
  @$pb.TagNumber(2)
  void clearFilesTotal() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get bytesDone => $_getI64(2);
  @$pb.TagNumber(3)
  set bytesDone($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasBytesDone() => $_has(2);
  @$pb.TagNumber(3)
  void clearBytesDone() => $_clearField(3);

  @$pb.TagNumber(4)
  $fixnum.Int64 get bytesTotal => $_getI64(3);
  @$pb.TagNumber(4)
  set bytesTotal($fixnum.Int64 value) => $_setInt64(3, value);
  @$pb.TagNumber(4)
  $core.bool hasBytesTotal() => $_has(3);
  @$pb.TagNumber(4)
  void clearBytesTotal() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get done => $_getBF(4);
  @$pb.TagNumber(5)
  set done($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasDone() => $_has(4);
  @$pb.TagNumber(5)
  void clearDone() => $_clearField(5);

  /// Only on the last message: the numbers of live songs whose file could not be read; they are not in the export.
  @$pb.TagNumber(6)
  $pb.PbList<$core.String> get skippedNumbers => $_getList(5);

  /// Only on the last message: the cleaned absolute folder.
  @$pb.TagNumber(7)
  $core.String get folder => $_getSZ(6);
  @$pb.TagNumber(7)
  set folder($core.String value) => $_setString(6, value);
  @$pb.TagNumber(7)
  $core.bool hasFolder() => $_has(6);
  @$pb.TagNumber(7)
  void clearFolder() => $_clearField(7);
}

/// The export folder to read, an absolute path on the server's disk.
class InspectExportRequest extends $pb.GeneratedMessage {
  factory InspectExportRequest({
    $core.String? folder,
  }) {
    final result = InspectExportRequest._();
    if (folder != null) result.folder = folder;
    return result;
  }

  InspectExportRequest._();

  factory InspectExportRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      InspectExportRequest()..mergeFromBuffer(data, registry);
  factory InspectExportRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      InspectExportRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'InspectExportRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: InspectExportRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'folder')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  InspectExportRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  InspectExportRequest copyWith(void Function(InspectExportRequest) updates) =>
      super.copyWith((message) => updates(message as InspectExportRequest))
          as InspectExportRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use InspectExportRequest() / InspectExportRequest.new instead')
  static InspectExportRequest create() => InspectExportRequest._();
  static $pb.GeneratedMessage $_createMessage() => InspectExportRequest._();
  @$core.override
  InspectExportRequest createEmptyInstance() => InspectExportRequest._();
  @$core.pragma('dart2js:noInline')
  static InspectExportRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<InspectExportRequest>(
          InspectExportRequest.$_createMessage);
  static InspectExportRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get folder => $_getSZ(0);
  @$pb.TagNumber(1)
  set folder($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFolder() => $_has(0);
  @$pb.TagNumber(1)
  void clearFolder() => $_clearField(1);
}

/// What an export folder holds.
class InspectExportResponse extends $pb.GeneratedMessage {
  factory InspectExportResponse({
    $core.String? serverName,
    $core.String? kantaheVersion,
    $fixnum.Int64? createdUnix,
    $core.int? songs,
    $core.int? users,
    $core.int? videos,
    $fixnum.Int64? bytesTotal,
    $core.bool? importable,
    $core.String? reason,
  }) {
    final result = InspectExportResponse._();
    if (serverName != null) result.serverName = serverName;
    if (kantaheVersion != null) result.kantaheVersion = kantaheVersion;
    if (createdUnix != null) result.createdUnix = createdUnix;
    if (songs != null) result.songs = songs;
    if (users != null) result.users = users;
    if (videos != null) result.videos = videos;
    if (bytesTotal != null) result.bytesTotal = bytesTotal;
    if (importable != null) result.importable = importable;
    if (reason != null) result.reason = reason;
    return result;
  }

  InspectExportResponse._();

  factory InspectExportResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      InspectExportResponse()..mergeFromBuffer(data, registry);
  factory InspectExportResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      InspectExportResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'InspectExportResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: InspectExportResponse.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'serverName')
    ..aOS(2, _omitFieldNames ? '' : 'kantaheVersion')
    ..aInt64(3, _omitFieldNames ? '' : 'createdUnix')
    ..aI(4, _omitFieldNames ? '' : 'songs')
    ..aI(5, _omitFieldNames ? '' : 'users')
    ..aI(6, _omitFieldNames ? '' : 'videos')
    ..aInt64(7, _omitFieldNames ? '' : 'bytesTotal')
    ..aOB(8, _omitFieldNames ? '' : 'importable')
    ..aOS(9, _omitFieldNames ? '' : 'reason')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  InspectExportResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  InspectExportResponse copyWith(
          void Function(InspectExportResponse) updates) =>
      super.copyWith((message) => updates(message as InspectExportResponse))
          as InspectExportResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use InspectExportResponse() / InspectExportResponse.new instead')
  static InspectExportResponse create() => InspectExportResponse._();
  static $pb.GeneratedMessage $_createMessage() => InspectExportResponse._();
  @$core.override
  InspectExportResponse createEmptyInstance() => InspectExportResponse._();
  @$core.pragma('dart2js:noInline')
  static InspectExportResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<InspectExportResponse>(
          InspectExportResponse.$_createMessage);
  static InspectExportResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get serverName => $_getSZ(0);
  @$pb.TagNumber(1)
  set serverName($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasServerName() => $_has(0);
  @$pb.TagNumber(1)
  void clearServerName() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get kantaheVersion => $_getSZ(1);
  @$pb.TagNumber(2)
  set kantaheVersion($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasKantaheVersion() => $_has(1);
  @$pb.TagNumber(2)
  void clearKantaheVersion() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get createdUnix => $_getI64(2);
  @$pb.TagNumber(3)
  set createdUnix($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasCreatedUnix() => $_has(2);
  @$pb.TagNumber(3)
  void clearCreatedUnix() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.int get songs => $_getIZ(3);
  @$pb.TagNumber(4)
  set songs($core.int value) => $_setSignedInt32(3, value);
  @$pb.TagNumber(4)
  $core.bool hasSongs() => $_has(3);
  @$pb.TagNumber(4)
  void clearSongs() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.int get users => $_getIZ(4);
  @$pb.TagNumber(5)
  set users($core.int value) => $_setSignedInt32(4, value);
  @$pb.TagNumber(5)
  $core.bool hasUsers() => $_has(4);
  @$pb.TagNumber(5)
  void clearUsers() => $_clearField(5);

  @$pb.TagNumber(6)
  $core.int get videos => $_getIZ(5);
  @$pb.TagNumber(6)
  set videos($core.int value) => $_setSignedInt32(5, value);
  @$pb.TagNumber(6)
  $core.bool hasVideos() => $_has(5);
  @$pb.TagNumber(6)
  void clearVideos() => $_clearField(6);

  @$pb.TagNumber(7)
  $fixnum.Int64 get bytesTotal => $_getI64(6);
  @$pb.TagNumber(7)
  set bytesTotal($fixnum.Int64 value) => $_setInt64(6, value);
  @$pb.TagNumber(7)
  $core.bool hasBytesTotal() => $_has(6);
  @$pb.TagNumber(7)
  void clearBytesTotal() => $_clearField(7);

  @$pb.TagNumber(8)
  $core.bool get importable => $_getBF(7);
  @$pb.TagNumber(8)
  set importable($core.bool value) => $_setBool(7, value);
  @$pb.TagNumber(8)
  $core.bool hasImportable() => $_has(7);
  @$pb.TagNumber(8)
  void clearImportable() => $_clearField(8);

  /// Why the folder cannot be imported; set when importable is false.
  @$pb.TagNumber(9)
  $core.String get reason => $_getSZ(8);
  @$pb.TagNumber(9)
  set reason($core.String value) => $_setString(8, value);
  @$pb.TagNumber(9)
  $core.bool hasReason() => $_has(8);
  @$pb.TagNumber(9)
  void clearReason() => $_clearField(9);
}

/// The export folder to import, an absolute path on the server's disk.
class ImportDataRequest extends $pb.GeneratedMessage {
  factory ImportDataRequest({
    $core.String? folder,
  }) {
    final result = ImportDataRequest._();
    if (folder != null) result.folder = folder;
    return result;
  }

  ImportDataRequest._();

  factory ImportDataRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ImportDataRequest()..mergeFromBuffer(data, registry);
  factory ImportDataRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ImportDataRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ImportDataRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ImportDataRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'folder')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ImportDataRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ImportDataRequest copyWith(void Function(ImportDataRequest) updates) =>
      super.copyWith((message) => updates(message as ImportDataRequest))
          as ImportDataRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ImportDataRequest() / ImportDataRequest.new instead')
  static ImportDataRequest create() => ImportDataRequest._();
  static $pb.GeneratedMessage $_createMessage() => ImportDataRequest._();
  @$core.override
  ImportDataRequest createEmptyInstance() => ImportDataRequest._();
  @$core.pragma('dart2js:noInline')
  static ImportDataRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ImportDataRequest>(
          ImportDataRequest.$_createMessage);
  static ImportDataRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get folder => $_getSZ(0);
  @$pb.TagNumber(1)
  set folder($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFolder() => $_has(0);
  @$pb.TagNumber(1)
  void clearFolder() => $_clearField(1);
}

/// Progress of an import; the last message has done = true.
class ImportDataResponse extends $pb.GeneratedMessage {
  factory ImportDataResponse({
    $core.int? filesDone,
    $core.int? filesTotal,
    $fixnum.Int64? bytesDone,
    $fixnum.Int64? bytesTotal,
    $core.bool? done,
    $core.bool? restarting,
  }) {
    final result = ImportDataResponse._();
    if (filesDone != null) result.filesDone = filesDone;
    if (filesTotal != null) result.filesTotal = filesTotal;
    if (bytesDone != null) result.bytesDone = bytesDone;
    if (bytesTotal != null) result.bytesTotal = bytesTotal;
    if (done != null) result.done = done;
    if (restarting != null) result.restarting = restarting;
    return result;
  }

  ImportDataResponse._();

  factory ImportDataResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ImportDataResponse()..mergeFromBuffer(data, registry);
  factory ImportDataResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ImportDataResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ImportDataResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ImportDataResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'filesDone')
    ..aI(2, _omitFieldNames ? '' : 'filesTotal')
    ..aInt64(3, _omitFieldNames ? '' : 'bytesDone')
    ..aInt64(4, _omitFieldNames ? '' : 'bytesTotal')
    ..aOB(5, _omitFieldNames ? '' : 'done')
    ..aOB(6, _omitFieldNames ? '' : 'restarting')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ImportDataResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ImportDataResponse copyWith(void Function(ImportDataResponse) updates) =>
      super.copyWith((message) => updates(message as ImportDataResponse))
          as ImportDataResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ImportDataResponse() / ImportDataResponse.new instead')
  static ImportDataResponse create() => ImportDataResponse._();
  static $pb.GeneratedMessage $_createMessage() => ImportDataResponse._();
  @$core.override
  ImportDataResponse createEmptyInstance() => ImportDataResponse._();
  @$core.pragma('dart2js:noInline')
  static ImportDataResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ImportDataResponse>(
          ImportDataResponse.$_createMessage);
  static ImportDataResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get filesDone => $_getIZ(0);
  @$pb.TagNumber(1)
  set filesDone($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFilesDone() => $_has(0);
  @$pb.TagNumber(1)
  void clearFilesDone() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get filesTotal => $_getIZ(1);
  @$pb.TagNumber(2)
  set filesTotal($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasFilesTotal() => $_has(1);
  @$pb.TagNumber(2)
  void clearFilesTotal() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get bytesDone => $_getI64(2);
  @$pb.TagNumber(3)
  set bytesDone($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasBytesDone() => $_has(2);
  @$pb.TagNumber(3)
  void clearBytesDone() => $_clearField(3);

  @$pb.TagNumber(4)
  $fixnum.Int64 get bytesTotal => $_getI64(3);
  @$pb.TagNumber(4)
  set bytesTotal($fixnum.Int64 value) => $_setInt64(3, value);
  @$pb.TagNumber(4)
  $core.bool hasBytesTotal() => $_has(3);
  @$pb.TagNumber(4)
  void clearBytesTotal() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get done => $_getBF(4);
  @$pb.TagNumber(5)
  set done($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasDone() => $_has(4);
  @$pb.TagNumber(5)
  void clearDone() => $_clearField(5);

  /// Only on the last message: the server restarts now to apply the import.
  @$pb.TagNumber(6)
  $core.bool get restarting => $_getBF(5);
  @$pb.TagNumber(6)
  set restarting($core.bool value) => $_setBool(5, value);
  @$pb.TagNumber(6)
  $core.bool hasRestarting() => $_has(5);
  @$pb.TagNumber(6)
  void clearRestarting() => $_clearField(6);
}

/// The song whose file is wanted.
class GetSongDownloadRequest extends $pb.GeneratedMessage {
  factory GetSongDownloadRequest({
    $core.String? number,
  }) {
    final result = GetSongDownloadRequest._();
    if (number != null) result.number = number;
    return result;
  }

  GetSongDownloadRequest._();

  factory GetSongDownloadRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongDownloadRequest()..mergeFromBuffer(data, registry);
  factory GetSongDownloadRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongDownloadRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetSongDownloadRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetSongDownloadRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongDownloadRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongDownloadRequest copyWith(
          void Function(GetSongDownloadRequest) updates) =>
      super.copyWith((message) => updates(message as GetSongDownloadRequest))
          as GetSongDownloadRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetSongDownloadRequest() / GetSongDownloadRequest.new instead')
  static GetSongDownloadRequest create() => GetSongDownloadRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetSongDownloadRequest._();
  @$core.override
  GetSongDownloadRequest createEmptyInstance() => GetSongDownloadRequest._();
  @$core.pragma('dart2js:noInline')
  static GetSongDownloadRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetSongDownloadRequest>(
          GetSongDownloadRequest.$_createMessage);
  static GetSongDownloadRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);
}

/// url is a path with a query, relative to the server address (like the media addresses); file_name is the name the file should be saved as.
class GetSongDownloadResponse extends $pb.GeneratedMessage {
  factory GetSongDownloadResponse({
    $core.String? url,
    $core.String? fileName,
    $fixnum.Int64? expiresUnix,
  }) {
    final result = GetSongDownloadResponse._();
    if (url != null) result.url = url;
    if (fileName != null) result.fileName = fileName;
    if (expiresUnix != null) result.expiresUnix = expiresUnix;
    return result;
  }

  GetSongDownloadResponse._();

  factory GetSongDownloadResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongDownloadResponse()..mergeFromBuffer(data, registry);
  factory GetSongDownloadResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongDownloadResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetSongDownloadResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetSongDownloadResponse.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'url')
    ..aOS(2, _omitFieldNames ? '' : 'fileName')
    ..aInt64(3, _omitFieldNames ? '' : 'expiresUnix')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongDownloadResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongDownloadResponse copyWith(
          void Function(GetSongDownloadResponse) updates) =>
      super.copyWith((message) => updates(message as GetSongDownloadResponse))
          as GetSongDownloadResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetSongDownloadResponse() / GetSongDownloadResponse.new instead')
  static GetSongDownloadResponse create() => GetSongDownloadResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetSongDownloadResponse._();
  @$core.override
  GetSongDownloadResponse createEmptyInstance() => GetSongDownloadResponse._();
  @$core.pragma('dart2js:noInline')
  static GetSongDownloadResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetSongDownloadResponse>(
          GetSongDownloadResponse.$_createMessage);
  static GetSongDownloadResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get url => $_getSZ(0);
  @$pb.TagNumber(1)
  set url($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUrl() => $_has(0);
  @$pb.TagNumber(1)
  void clearUrl() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get fileName => $_getSZ(1);
  @$pb.TagNumber(2)
  set fileName($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasFileName() => $_has(1);
  @$pb.TagNumber(2)
  void clearFileName() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get expiresUnix => $_getI64(2);
  @$pb.TagNumber(3)
  set expiresUnix($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasExpiresUnix() => $_has(2);
  @$pb.TagNumber(3)
  void clearExpiresUnix() => $_clearField(3);
}

/// Administration; every RPC requires the admin role (PERMISSION_DENIED otherwise).
class AdminServiceApi {
  final $pb.RpcClient _client;

  AdminServiceApi(this._client);

  /// Admin only. Lists every user.
  $async.Future<ListUsersResponse> listUsers(
          $pb.ClientContext? ctx, ListUsersRequest request) =>
      _client.invoke<ListUsersResponse>(
          ctx, 'AdminService', 'ListUsers', request, ListUsersResponse());

  /// Admin only. ALREADY_EXISTS for a duplicate email; the user must change the temporary password.
  $async.Future<CreateUserResponse> createUser(
          $pb.ClientContext? ctx, CreateUserRequest request) =>
      _client.invoke<CreateUserResponse>(
          ctx, 'AdminService', 'CreateUser', request, CreateUserResponse());

  /// Admin only. Unset optional fields are left unchanged; the last admin cannot be demoted or disabled.
  $async.Future<UpdateUserResponse> updateUser(
          $pb.ClientContext? ctx, UpdateUserRequest request) =>
      _client.invoke<UpdateUserResponse>(
          ctx, 'AdminService', 'UpdateUser', request, UpdateUserResponse());

  /// Admin only. Sets a temporary password, must_change_password, and revokes the user's devices.
  $async.Future<ResetPasswordResponse> resetPassword(
          $pb.ClientContext? ctx, ResetPasswordRequest request) =>
      _client.invoke<ResetPasswordResponse>(ctx, 'AdminService',
          'ResetPassword', request, ResetPasswordResponse());

  /// Admin only. The last admin cannot be deleted.
  $async.Future<DeleteUserResponse> deleteUser(
          $pb.ClientContext? ctx, DeleteUserRequest request) =>
      _client.invoke<DeleteUserResponse>(
          ctx, 'AdminService', 'DeleteUser', request, DeleteUserResponse());

  /// Admin only. Signs out every device of the user and returns how many.
  $async.Future<RevokeUserDevicesResponse> revokeUserDevices(
          $pb.ClientContext? ctx, RevokeUserDevicesRequest request) =>
      _client.invoke<RevokeUserDevicesResponse>(ctx, 'AdminService',
          'RevokeUserDevices', request, RevokeUserDevicesResponse());

  /// Admin only. Title and artist edits survive rescans and always win over file metadata.
  $async.Future<UpdateSongResponse> updateSong(
          $pb.ClientContext? ctx, UpdateSongRequest request) =>
      _client.invoke<UpdateSongResponse>(
          ctx, 'AdminService', 'UpdateSong', request, UpdateSongResponse());

  /// Admin only. Removes the entry and, unless keep_file is set, its file; fails with the reason if the file cannot be deleted.
  $async.Future<DeleteSongResponse> deleteSong(
          $pb.ClientContext? ctx, DeleteSongRequest request) =>
      _client.invoke<DeleteSongResponse>(
          ctx, 'AdminService', 'DeleteSong', request, DeleteSongResponse());

  /// Admin only. Removes many songs from the list at once. The song files are never deleted, except with scope BROKEN and delete_files.
  $async.Future<RemoveSongsResponse> removeSongs(
          $pb.ClientContext? ctx, RemoveSongsRequest request) =>
      _client.invoke<RemoveSongsResponse>(
          ctx, 'AdminService', 'RemoveSongs', request, RemoveSongsResponse());

  /// Admin only. Takes the chosen songs off the list (at most 1000 numbers); with delete_files their files are deleted too (only inside the data and library folders). Numbers that are unknown or already removed are skipped.
  $async.Future<RemoveSelectedSongsResponse> removeSelectedSongs(
          $pb.ClientContext? ctx, RemoveSelectedSongsRequest request) =>
      _client.invoke<RemoveSelectedSongsResponse>(ctx, 'AdminService',
          'RemoveSelectedSongs', request, RemoveSelectedSongsResponse());

  /// Admin only. Re-judges every live song (file missing, MIDI without music, unparsable, a .karmp3 whose audio cannot be read), marks the
  /// broken ones as failed (they leave every user's lists and searches) and clears the mark of repaired ones. Streams its progress; the
  /// last message has done = true. FAILED_PRECONDITION when a check is already running.
  $async.Future<CheckLibraryResponse> checkLibrary(
          $pb.ClientContext? ctx, CheckLibraryRequest request) =>
      _client.invoke<CheckLibraryResponse>(
          ctx, 'AdminService', 'CheckLibrary', request, CheckLibraryResponse());

  /// Admin only. Lists the songs marked broken, with the reason, ordered by number.
  $async.Future<ListBrokenSongsResponse> listBrokenSongs(
          $pb.ClientContext? ctx, ListBrokenSongsRequest request) =>
      _client.invoke<ListBrokenSongsResponse>(ctx, 'AdminService',
          'ListBrokenSongs', request, ListBrokenSongsResponse());

  /// Admin only. The background videos in loop order, each with a signed preview URL (1 hour).
  $async.Future<ListVideosResponse> listVideos(
          $pb.ClientContext? ctx, ListVideosRequest request) =>
      _client.invoke<ListVideosResponse>(
          ctx, 'AdminService', 'ListVideos', request, ListVideosResponse());

  /// Admin only. Renames or enables/disables a video; unset optional fields are left unchanged; NOT_FOUND for an unknown id.
  $async.Future<UpdateVideoResponse> updateVideo(
          $pb.ClientContext? ctx, UpdateVideoRequest request) =>
      _client.invoke<UpdateVideoResponse>(
          ctx, 'AdminService', 'UpdateVideo', request, UpdateVideoResponse());

  /// Admin only. Sets the loop order; ids must be exactly the existing ids (INVALID_ARGUMENT otherwise).
  $async.Future<ReorderVideosResponse> reorderVideos(
          $pb.ClientContext? ctx, ReorderVideosRequest request) =>
      _client.invoke<ReorderVideosResponse>(ctx, 'AdminService',
          'ReorderVideos', request, ReorderVideosResponse());

  /// Admin only. Removes the video and its file; NOT_FOUND for an unknown id.
  $async.Future<DeleteVideoResponse> deleteVideo(
          $pb.ClientContext? ctx, DeleteVideoRequest request) =>
      _client.invoke<DeleteVideoResponse>(
          ctx, 'AdminService', 'DeleteVideo', request, DeleteVideoResponse());

  /// Admin only. Rescans watched folders and reports the counts.
  $async.Future<RescanResponse> rescan(
          $pb.ClientContext? ctx, RescanRequest request) =>
      _client.invoke<RescanResponse>(
          ctx, 'AdminService', 'Rescan', request, RescanResponse());

  /// Admin only. Reads the server settings.
  $async.Future<GetServerSettingsResponse> getServerSettings(
          $pb.ClientContext? ctx, GetServerSettingsRequest request) =>
      _client.invoke<GetServerSettingsResponse>(ctx, 'AdminService',
          'GetServerSettings', request, GetServerSettingsResponse());

  /// Admin only. Unset optional fields are left unchanged; INVALID_ARGUMENT for out-of-range values.
  $async.Future<UpdateServerSettingsResponse> updateServerSettings(
          $pb.ClientContext? ctx, UpdateServerSettingsRequest request) =>
      _client.invoke<UpdateServerSettingsResponse>(ctx, 'AdminService',
          'UpdateServerSettings', request, UpdateServerSettingsResponse());

  /// Admin only. Writes a copy of the whole server (database, settings, every song file, extracted MP3s, background videos) into a new or
  /// empty folder on the server's disk. Streams progress; the last message has done = true. INVALID_ARGUMENT for a folder that is not
  /// allowed; FAILED_PRECONDITION while another export or import runs.
  $async.Future<ExportDataResponse> exportData(
          $pb.ClientContext? ctx, ExportDataRequest request) =>
      _client.invoke<ExportDataResponse>(
          ctx, 'AdminService', 'ExportData', request, ExportDataResponse());

  /// Admin only. Reads the manifest of an export folder and says whether it can be imported; changes nothing.
  $async.Future<InspectExportResponse> inspectExport(
          $pb.ClientContext? ctx, InspectExportRequest request) =>
      _client.invoke<InspectExportResponse>(ctx, 'AdminService',
          'InspectExport', request, InspectExportResponse());

  /// Admin only. Checks and stages an export folder; the server then restarts and replaces all of its data with it. Streams progress; the
  /// last message has done = true. INVALID_ARGUMENT for a folder that cannot be imported; FAILED_PRECONDITION while another export or
  /// import runs.
  $async.Future<ImportDataResponse> importData(
          $pb.ClientContext? ctx, ImportDataRequest request) =>
      _client.invoke<ImportDataResponse>(
          ctx, 'AdminService', 'ImportData', request, ImportDataResponse());

  /// Admin only. A signed address (valid for 10 minutes, for the asking administrator) from which the stored file of a song is downloaded as it is: the
  /// .karmp3 ZIP or the .kar file. NOT_FOUND for a number that is not a live song.
  $async.Future<GetSongDownloadResponse> getSongDownload(
          $pb.ClientContext? ctx, GetSongDownloadRequest request) =>
      _client.invoke<GetSongDownloadResponse>(ctx, 'AdminService',
          'GetSongDownload', request, GetSongDownloadResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
