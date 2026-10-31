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
  }) {
    final result = RemoveSongsRequest._();
    if (scope != null) result.scope = scope;
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
}

/// How many songs left the list.
class RemoveSongsResponse extends $pb.GeneratedMessage {
  factory RemoveSongsResponse({
    $core.int? removed,
  }) {
    final result = RemoveSongsResponse._();
    if (removed != null) result.removed = removed;
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

/// Server-wide limits: upload size per file and how long the score screen shows.
class ServerSettings extends $pb.GeneratedMessage {
  factory ServerSettings({
    $fixnum.Int64? maxUploadBytes,
    $core.int? scoreSeconds,
  }) {
    final result = ServerSettings._();
    if (maxUploadBytes != null) result.maxUploadBytes = maxUploadBytes;
    if (scoreSeconds != null) result.scoreSeconds = scoreSeconds;
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
}

/// Partial update of the server settings.
class UpdateServerSettingsRequest extends $pb.GeneratedMessage {
  factory UpdateServerSettingsRequest({
    $fixnum.Int64? maxUploadBytes,
    $core.int? scoreSeconds,
  }) {
    final result = UpdateServerSettingsRequest._();
    if (maxUploadBytes != null) result.maxUploadBytes = maxUploadBytes;
    if (scoreSeconds != null) result.scoreSeconds = scoreSeconds;
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

  /// Admin only. Removes many songs from the list at once. The song files are never deleted.
  $async.Future<RemoveSongsResponse> removeSongs(
          $pb.ClientContext? ctx, RemoveSongsRequest request) =>
      _client.invoke<RemoveSongsResponse>(
          ctx, 'AdminService', 'RemoveSongs', request, RemoveSongsResponse());

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
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
