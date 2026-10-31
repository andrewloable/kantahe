// This is a generated file - do not edit.
//
// Generated from kantahe/v1/session.proto.

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
import 'session.pbenum.dart';

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

export 'session.pbenum.dart';

/// Asks nothing; the stream belongs to the calling device.
class WatchStateRequest extends $pb.GeneratedMessage {
  factory WatchStateRequest() => WatchStateRequest._();

  WatchStateRequest._();

  factory WatchStateRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WatchStateRequest()..mergeFromBuffer(data, registry);
  factory WatchStateRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WatchStateRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'WatchStateRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: WatchStateRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WatchStateRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WatchStateRequest copyWith(void Function(WatchStateRequest) updates) =>
      super.copyWith((message) => updates(message as WatchStateRequest))
          as WatchStateRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use WatchStateRequest() / WatchStateRequest.new instead')
  static WatchStateRequest create() => WatchStateRequest._();
  static $pb.GeneratedMessage $_createMessage() => WatchStateRequest._();
  @$core.override
  WatchStateRequest createEmptyInstance() => WatchStateRequest._();
  @$core.pragma('dart2js:noInline')
  static WatchStateRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<WatchStateRequest>(
          WatchStateRequest.$_createMessage);
  static WatchStateRequest? _defaultInstance;
}

/// One full snapshot of the caller's state.
class WatchStateResponse extends $pb.GeneratedMessage {
  factory WatchStateResponse({
    State? state,
  }) {
    final result = WatchStateResponse._();
    if (state != null) result.state = state;
    return result;
  }

  WatchStateResponse._();

  factory WatchStateResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WatchStateResponse()..mergeFromBuffer(data, registry);
  factory WatchStateResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      WatchStateResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'WatchStateResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: WatchStateResponse.$_createMessage)
    ..aOM<State>(1, _omitFieldNames ? '' : 'state',
        subBuilder: State.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WatchStateResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  WatchStateResponse copyWith(void Function(WatchStateResponse) updates) =>
      super.copyWith((message) => updates(message as WatchStateResponse))
          as WatchStateResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use WatchStateResponse() / WatchStateResponse.new instead')
  static WatchStateResponse create() => WatchStateResponse._();
  static $pb.GeneratedMessage $_createMessage() => WatchStateResponse._();
  @$core.override
  WatchStateResponse createEmptyInstance() => WatchStateResponse._();
  @$core.pragma('dart2js:noInline')
  static WatchStateResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<WatchStateResponse>(
          WatchStateResponse.$_createMessage);
  static WatchStateResponse? _defaultInstance;

  @$pb.TagNumber(1)
  State get state => $_getN(0);
  @$pb.TagNumber(1)
  set state(State value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasState() => $_has(0);
  @$pb.TagNumber(1)
  void clearState() => $_clearField(1);
  @$pb.TagNumber(1)
  State ensureState() => $_ensure(0);
}

/// Asks nothing.
class GetStateRequest extends $pb.GeneratedMessage {
  factory GetStateRequest() => GetStateRequest._();

  GetStateRequest._();

  factory GetStateRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetStateRequest()..mergeFromBuffer(data, registry);
  factory GetStateRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetStateRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetStateRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetStateRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetStateRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetStateRequest copyWith(void Function(GetStateRequest) updates) =>
      super.copyWith((message) => updates(message as GetStateRequest))
          as GetStateRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetStateRequest() / GetStateRequest.new instead')
  static GetStateRequest create() => GetStateRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetStateRequest._();
  @$core.override
  GetStateRequest createEmptyInstance() => GetStateRequest._();
  @$core.pragma('dart2js:noInline')
  static GetStateRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<GetStateRequest>(
          GetStateRequest.$_createMessage);
  static GetStateRequest? _defaultInstance;
}

/// The caller's current state.
class GetStateResponse extends $pb.GeneratedMessage {
  factory GetStateResponse({
    State? state,
  }) {
    final result = GetStateResponse._();
    if (state != null) result.state = state;
    return result;
  }

  GetStateResponse._();

  factory GetStateResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetStateResponse()..mergeFromBuffer(data, registry);
  factory GetStateResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetStateResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetStateResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetStateResponse.$_createMessage)
    ..aOM<State>(1, _omitFieldNames ? '' : 'state',
        subBuilder: State.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetStateResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetStateResponse copyWith(void Function(GetStateResponse) updates) =>
      super.copyWith((message) => updates(message as GetStateResponse))
          as GetStateResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetStateResponse() / GetStateResponse.new instead')
  static GetStateResponse create() => GetStateResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetStateResponse._();
  @$core.override
  GetStateResponse createEmptyInstance() => GetStateResponse._();
  @$core.pragma('dart2js:noInline')
  static GetStateResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<GetStateResponse>(
          GetStateResponse.$_createMessage);
  static GetStateResponse? _defaultInstance;

  @$pb.TagNumber(1)
  State get state => $_getN(0);
  @$pb.TagNumber(1)
  set state(State value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasState() => $_has(0);
  @$pb.TagNumber(1)
  void clearState() => $_clearField(1);
  @$pb.TagNumber(1)
  State ensureState() => $_ensure(0);
}

/// The number of the song to append.
class AddToQueueRequest extends $pb.GeneratedMessage {
  factory AddToQueueRequest({
    $core.String? number,
  }) {
    final result = AddToQueueRequest._();
    if (number != null) result.number = number;
    return result;
  }

  AddToQueueRequest._();

  factory AddToQueueRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddToQueueRequest()..mergeFromBuffer(data, registry);
  factory AddToQueueRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddToQueueRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AddToQueueRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AddToQueueRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddToQueueRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddToQueueRequest copyWith(void Function(AddToQueueRequest) updates) =>
      super.copyWith((message) => updates(message as AddToQueueRequest))
          as AddToQueueRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use AddToQueueRequest() / AddToQueueRequest.new instead')
  static AddToQueueRequest create() => AddToQueueRequest._();
  static $pb.GeneratedMessage $_createMessage() => AddToQueueRequest._();
  @$core.override
  AddToQueueRequest createEmptyInstance() => AddToQueueRequest._();
  @$core.pragma('dart2js:noInline')
  static AddToQueueRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<AddToQueueRequest>(
          AddToQueueRequest.$_createMessage);
  static AddToQueueRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);
}

/// The new queue item.
class AddToQueueResponse extends $pb.GeneratedMessage {
  factory AddToQueueResponse({
    QueueItem? item,
  }) {
    final result = AddToQueueResponse._();
    if (item != null) result.item = item;
    return result;
  }

  AddToQueueResponse._();

  factory AddToQueueResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddToQueueResponse()..mergeFromBuffer(data, registry);
  factory AddToQueueResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddToQueueResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AddToQueueResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AddToQueueResponse.$_createMessage)
    ..aOM<QueueItem>(1, _omitFieldNames ? '' : 'item',
        subBuilder: QueueItem.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddToQueueResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddToQueueResponse copyWith(void Function(AddToQueueResponse) updates) =>
      super.copyWith((message) => updates(message as AddToQueueResponse))
          as AddToQueueResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use AddToQueueResponse() / AddToQueueResponse.new instead')
  static AddToQueueResponse create() => AddToQueueResponse._();
  static $pb.GeneratedMessage $_createMessage() => AddToQueueResponse._();
  @$core.override
  AddToQueueResponse createEmptyInstance() => AddToQueueResponse._();
  @$core.pragma('dart2js:noInline')
  static AddToQueueResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<AddToQueueResponse>(
          AddToQueueResponse.$_createMessage);
  static AddToQueueResponse? _defaultInstance;

  @$pb.TagNumber(1)
  QueueItem get item => $_getN(0);
  @$pb.TagNumber(1)
  set item(QueueItem value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasItem() => $_has(0);
  @$pb.TagNumber(1)
  void clearItem() => $_clearField(1);
  @$pb.TagNumber(1)
  QueueItem ensureItem() => $_ensure(0);
}

/// A playlist owned by the caller.
class AddPlaylistToQueueRequest extends $pb.GeneratedMessage {
  factory AddPlaylistToQueueRequest({
    $core.String? playlistId,
  }) {
    final result = AddPlaylistToQueueRequest._();
    if (playlistId != null) result.playlistId = playlistId;
    return result;
  }

  AddPlaylistToQueueRequest._();

  factory AddPlaylistToQueueRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddPlaylistToQueueRequest()..mergeFromBuffer(data, registry);
  factory AddPlaylistToQueueRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddPlaylistToQueueRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AddPlaylistToQueueRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AddPlaylistToQueueRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'playlistId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddPlaylistToQueueRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddPlaylistToQueueRequest copyWith(
          void Function(AddPlaylistToQueueRequest) updates) =>
      super.copyWith((message) => updates(message as AddPlaylistToQueueRequest))
          as AddPlaylistToQueueRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use AddPlaylistToQueueRequest() / AddPlaylistToQueueRequest.new instead')
  static AddPlaylistToQueueRequest create() => AddPlaylistToQueueRequest._();
  static $pb.GeneratedMessage $_createMessage() =>
      AddPlaylistToQueueRequest._();
  @$core.override
  AddPlaylistToQueueRequest createEmptyInstance() =>
      AddPlaylistToQueueRequest._();
  @$core.pragma('dart2js:noInline')
  static AddPlaylistToQueueRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<AddPlaylistToQueueRequest>(
          AddPlaylistToQueueRequest.$_createMessage);
  static AddPlaylistToQueueRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get playlistId => $_getSZ(0);
  @$pb.TagNumber(1)
  set playlistId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasPlaylistId() => $_has(0);
  @$pb.TagNumber(1)
  void clearPlaylistId() => $_clearField(1);
}

/// Number of songs appended.
class AddPlaylistToQueueResponse extends $pb.GeneratedMessage {
  factory AddPlaylistToQueueResponse({
    $core.int? added,
  }) {
    final result = AddPlaylistToQueueResponse._();
    if (added != null) result.added = added;
    return result;
  }

  AddPlaylistToQueueResponse._();

  factory AddPlaylistToQueueResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddPlaylistToQueueResponse()..mergeFromBuffer(data, registry);
  factory AddPlaylistToQueueResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AddPlaylistToQueueResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AddPlaylistToQueueResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AddPlaylistToQueueResponse.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'added')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddPlaylistToQueueResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AddPlaylistToQueueResponse copyWith(
          void Function(AddPlaylistToQueueResponse) updates) =>
      super.copyWith(
              (message) => updates(message as AddPlaylistToQueueResponse))
          as AddPlaylistToQueueResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use AddPlaylistToQueueResponse() / AddPlaylistToQueueResponse.new instead')
  static AddPlaylistToQueueResponse create() => AddPlaylistToQueueResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      AddPlaylistToQueueResponse._();
  @$core.override
  AddPlaylistToQueueResponse createEmptyInstance() =>
      AddPlaylistToQueueResponse._();
  @$core.pragma('dart2js:noInline')
  static AddPlaylistToQueueResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<AddPlaylistToQueueResponse>(
          AddPlaylistToQueueResponse.$_createMessage);
  static AddPlaylistToQueueResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get added => $_getIZ(0);
  @$pb.TagNumber(1)
  set added($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasAdded() => $_has(0);
  @$pb.TagNumber(1)
  void clearAdded() => $_clearField(1);
}

/// The queue item to remove.
class RemoveFromQueueRequest extends $pb.GeneratedMessage {
  factory RemoveFromQueueRequest({
    $core.String? itemId,
  }) {
    final result = RemoveFromQueueRequest._();
    if (itemId != null) result.itemId = itemId;
    return result;
  }

  RemoveFromQueueRequest._();

  factory RemoveFromQueueRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveFromQueueRequest()..mergeFromBuffer(data, registry);
  factory RemoveFromQueueRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveFromQueueRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RemoveFromQueueRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RemoveFromQueueRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'itemId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveFromQueueRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveFromQueueRequest copyWith(
          void Function(RemoveFromQueueRequest) updates) =>
      super.copyWith((message) => updates(message as RemoveFromQueueRequest))
          as RemoveFromQueueRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RemoveFromQueueRequest() / RemoveFromQueueRequest.new instead')
  static RemoveFromQueueRequest create() => RemoveFromQueueRequest._();
  static $pb.GeneratedMessage $_createMessage() => RemoveFromQueueRequest._();
  @$core.override
  RemoveFromQueueRequest createEmptyInstance() => RemoveFromQueueRequest._();
  @$core.pragma('dart2js:noInline')
  static RemoveFromQueueRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RemoveFromQueueRequest>(
          RemoveFromQueueRequest.$_createMessage);
  static RemoveFromQueueRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get itemId => $_getSZ(0);
  @$pb.TagNumber(1)
  set itemId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasItemId() => $_has(0);
  @$pb.TagNumber(1)
  void clearItemId() => $_clearField(1);
}

/// Empty.
class RemoveFromQueueResponse extends $pb.GeneratedMessage {
  factory RemoveFromQueueResponse() => RemoveFromQueueResponse._();

  RemoveFromQueueResponse._();

  factory RemoveFromQueueResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveFromQueueResponse()..mergeFromBuffer(data, registry);
  factory RemoveFromQueueResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      RemoveFromQueueResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'RemoveFromQueueResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: RemoveFromQueueResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveFromQueueResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  RemoveFromQueueResponse copyWith(
          void Function(RemoveFromQueueResponse) updates) =>
      super.copyWith((message) => updates(message as RemoveFromQueueResponse))
          as RemoveFromQueueResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use RemoveFromQueueResponse() / RemoveFromQueueResponse.new instead')
  static RemoveFromQueueResponse create() => RemoveFromQueueResponse._();
  static $pb.GeneratedMessage $_createMessage() => RemoveFromQueueResponse._();
  @$core.override
  RemoveFromQueueResponse createEmptyInstance() => RemoveFromQueueResponse._();
  @$core.pragma('dart2js:noInline')
  static RemoveFromQueueResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<RemoveFromQueueResponse>(
          RemoveFromQueueResponse.$_createMessage);
  static RemoveFromQueueResponse? _defaultInstance;
}

/// The queue item to move to the front.
class MoveToTopRequest extends $pb.GeneratedMessage {
  factory MoveToTopRequest({
    $core.String? itemId,
  }) {
    final result = MoveToTopRequest._();
    if (itemId != null) result.itemId = itemId;
    return result;
  }

  MoveToTopRequest._();

  factory MoveToTopRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MoveToTopRequest()..mergeFromBuffer(data, registry);
  factory MoveToTopRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MoveToTopRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'MoveToTopRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: MoveToTopRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'itemId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MoveToTopRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MoveToTopRequest copyWith(void Function(MoveToTopRequest) updates) =>
      super.copyWith((message) => updates(message as MoveToTopRequest))
          as MoveToTopRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use MoveToTopRequest() / MoveToTopRequest.new instead')
  static MoveToTopRequest create() => MoveToTopRequest._();
  static $pb.GeneratedMessage $_createMessage() => MoveToTopRequest._();
  @$core.override
  MoveToTopRequest createEmptyInstance() => MoveToTopRequest._();
  @$core.pragma('dart2js:noInline')
  static MoveToTopRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<MoveToTopRequest>(
          MoveToTopRequest.$_createMessage);
  static MoveToTopRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get itemId => $_getSZ(0);
  @$pb.TagNumber(1)
  set itemId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasItemId() => $_has(0);
  @$pb.TagNumber(1)
  void clearItemId() => $_clearField(1);
}

/// Empty.
class MoveToTopResponse extends $pb.GeneratedMessage {
  factory MoveToTopResponse() => MoveToTopResponse._();

  MoveToTopResponse._();

  factory MoveToTopResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MoveToTopResponse()..mergeFromBuffer(data, registry);
  factory MoveToTopResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      MoveToTopResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'MoveToTopResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: MoveToTopResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MoveToTopResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  MoveToTopResponse copyWith(void Function(MoveToTopResponse) updates) =>
      super.copyWith((message) => updates(message as MoveToTopResponse))
          as MoveToTopResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use MoveToTopResponse() / MoveToTopResponse.new instead')
  static MoveToTopResponse create() => MoveToTopResponse._();
  static $pb.GeneratedMessage $_createMessage() => MoveToTopResponse._();
  @$core.override
  MoveToTopResponse createEmptyInstance() => MoveToTopResponse._();
  @$core.pragma('dart2js:noInline')
  static MoveToTopResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<MoveToTopResponse>(
          MoveToTopResponse.$_createMessage);
  static MoveToTopResponse? _defaultInstance;
}

/// The action to perform.
class ControlRequest extends $pb.GeneratedMessage {
  factory ControlRequest({
    ControlAction? action,
  }) {
    final result = ControlRequest._();
    if (action != null) result.action = action;
    return result;
  }

  ControlRequest._();

  factory ControlRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ControlRequest()..mergeFromBuffer(data, registry);
  factory ControlRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ControlRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ControlRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ControlRequest.$_createMessage)
    ..aE<ControlAction>(1, _omitFieldNames ? '' : 'action',
        enumValues: ControlAction.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ControlRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ControlRequest copyWith(void Function(ControlRequest) updates) =>
      super.copyWith((message) => updates(message as ControlRequest))
          as ControlRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ControlRequest() / ControlRequest.new instead')
  static ControlRequest create() => ControlRequest._();
  static $pb.GeneratedMessage $_createMessage() => ControlRequest._();
  @$core.override
  ControlRequest createEmptyInstance() => ControlRequest._();
  @$core.pragma('dart2js:noInline')
  static ControlRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ControlRequest>(
          ControlRequest.$_createMessage);
  static ControlRequest? _defaultInstance;

  @$pb.TagNumber(1)
  ControlAction get action => $_getN(0);
  @$pb.TagNumber(1)
  set action(ControlAction value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasAction() => $_has(0);
  @$pb.TagNumber(1)
  void clearAction() => $_clearField(1);
}

/// Empty; the new state arrives through WatchState.
class ControlResponse extends $pb.GeneratedMessage {
  factory ControlResponse() => ControlResponse._();

  ControlResponse._();

  factory ControlResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ControlResponse()..mergeFromBuffer(data, registry);
  factory ControlResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ControlResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ControlResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ControlResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ControlResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ControlResponse copyWith(void Function(ControlResponse) updates) =>
      super.copyWith((message) => updates(message as ControlResponse))
          as ControlResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ControlResponse() / ControlResponse.new instead')
  static ControlResponse create() => ControlResponse._();
  static $pb.GeneratedMessage $_createMessage() => ControlResponse._();
  @$core.override
  ControlResponse createEmptyInstance() => ControlResponse._();
  @$core.pragma('dart2js:noInline')
  static ControlResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ControlResponse>(
          ControlResponse.$_createMessage);
  static ControlResponse? _defaultInstance;
}

/// Partial update of the caller's score settings.
class UpdateUserSettingsRequest extends $pb.GeneratedMessage {
  factory UpdateUserSettingsRequest({
    ScoreMode? scoreMode,
    ScoreLevel? scoreLevel,
  }) {
    final result = UpdateUserSettingsRequest._();
    if (scoreMode != null) result.scoreMode = scoreMode;
    if (scoreLevel != null) result.scoreLevel = scoreLevel;
    return result;
  }

  UpdateUserSettingsRequest._();

  factory UpdateUserSettingsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserSettingsRequest()..mergeFromBuffer(data, registry);
  factory UpdateUserSettingsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserSettingsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateUserSettingsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateUserSettingsRequest.$_createMessage)
    ..aE<ScoreMode>(1, _omitFieldNames ? '' : 'scoreMode',
        enumValues: ScoreMode.values)
    ..aE<ScoreLevel>(2, _omitFieldNames ? '' : 'scoreLevel',
        enumValues: ScoreLevel.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserSettingsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserSettingsRequest copyWith(
          void Function(UpdateUserSettingsRequest) updates) =>
      super.copyWith((message) => updates(message as UpdateUserSettingsRequest))
          as UpdateUserSettingsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UpdateUserSettingsRequest() / UpdateUserSettingsRequest.new instead')
  static UpdateUserSettingsRequest create() => UpdateUserSettingsRequest._();
  static $pb.GeneratedMessage $_createMessage() =>
      UpdateUserSettingsRequest._();
  @$core.override
  UpdateUserSettingsRequest createEmptyInstance() =>
      UpdateUserSettingsRequest._();
  @$core.pragma('dart2js:noInline')
  static UpdateUserSettingsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateUserSettingsRequest>(
          UpdateUserSettingsRequest.$_createMessage);
  static UpdateUserSettingsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  ScoreMode get scoreMode => $_getN(0);
  @$pb.TagNumber(1)
  set scoreMode(ScoreMode value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasScoreMode() => $_has(0);
  @$pb.TagNumber(1)
  void clearScoreMode() => $_clearField(1);

  @$pb.TagNumber(2)
  ScoreLevel get scoreLevel => $_getN(1);
  @$pb.TagNumber(2)
  set scoreLevel(ScoreLevel value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasScoreLevel() => $_has(1);
  @$pb.TagNumber(2)
  void clearScoreLevel() => $_clearField(2);
}

/// The settings after the update.
class UpdateUserSettingsResponse extends $pb.GeneratedMessage {
  factory UpdateUserSettingsResponse({
    UserSettings? settings,
  }) {
    final result = UpdateUserSettingsResponse._();
    if (settings != null) result.settings = settings;
    return result;
  }

  UpdateUserSettingsResponse._();

  factory UpdateUserSettingsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserSettingsResponse()..mergeFromBuffer(data, registry);
  factory UpdateUserSettingsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdateUserSettingsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdateUserSettingsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdateUserSettingsResponse.$_createMessage)
    ..aOM<UserSettings>(1, _omitFieldNames ? '' : 'settings',
        subBuilder: UserSettings.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserSettingsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdateUserSettingsResponse copyWith(
          void Function(UpdateUserSettingsResponse) updates) =>
      super.copyWith(
              (message) => updates(message as UpdateUserSettingsResponse))
          as UpdateUserSettingsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UpdateUserSettingsResponse() / UpdateUserSettingsResponse.new instead')
  static UpdateUserSettingsResponse create() => UpdateUserSettingsResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      UpdateUserSettingsResponse._();
  @$core.override
  UpdateUserSettingsResponse createEmptyInstance() =>
      UpdateUserSettingsResponse._();
  @$core.pragma('dart2js:noInline')
  static UpdateUserSettingsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdateUserSettingsResponse>(
          UpdateUserSettingsResponse.$_createMessage);
  static UpdateUserSettingsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  UserSettings get settings => $_getN(0);
  @$pb.TagNumber(1)
  set settings(UserSettings value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasSettings() => $_has(0);
  @$pb.TagNumber(1)
  void clearSettings() => $_clearField(1);
  @$pb.TagNumber(1)
  UserSettings ensureSettings() => $_ensure(0);
}

/// The song the player has loaded.
class ReadyRequest extends $pb.GeneratedMessage {
  factory ReadyRequest({
    $core.String? number,
  }) {
    final result = ReadyRequest._();
    if (number != null) result.number = number;
    return result;
  }

  ReadyRequest._();

  factory ReadyRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReadyRequest()..mergeFromBuffer(data, registry);
  factory ReadyRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReadyRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReadyRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReadyRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReadyRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReadyRequest copyWith(void Function(ReadyRequest) updates) =>
      super.copyWith((message) => updates(message as ReadyRequest))
          as ReadyRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ReadyRequest() / ReadyRequest.new instead')
  static ReadyRequest create() => ReadyRequest._();
  static $pb.GeneratedMessage $_createMessage() => ReadyRequest._();
  @$core.override
  ReadyRequest createEmptyInstance() => ReadyRequest._();
  @$core.pragma('dart2js:noInline')
  static ReadyRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ReadyRequest>(
          ReadyRequest.$_createMessage);
  static ReadyRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);
}

/// Empty.
class ReadyResponse extends $pb.GeneratedMessage {
  factory ReadyResponse() => ReadyResponse._();

  ReadyResponse._();

  factory ReadyResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReadyResponse()..mergeFromBuffer(data, registry);
  factory ReadyResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReadyResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReadyResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReadyResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReadyResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReadyResponse copyWith(void Function(ReadyResponse) updates) =>
      super.copyWith((message) => updates(message as ReadyResponse))
          as ReadyResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ReadyResponse() / ReadyResponse.new instead')
  static ReadyResponse create() => ReadyResponse._();
  static $pb.GeneratedMessage $_createMessage() => ReadyResponse._();
  @$core.override
  ReadyResponse createEmptyInstance() => ReadyResponse._();
  @$core.pragma('dart2js:noInline')
  static ReadyResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ReadyResponse>(
          ReadyResponse.$_createMessage);
  static ReadyResponse? _defaultInstance;
}

/// Playback position of the song with this number.
class ReportPositionRequest extends $pb.GeneratedMessage {
  factory ReportPositionRequest({
    $core.String? number,
    $fixnum.Int64? positionMs,
  }) {
    final result = ReportPositionRequest._();
    if (number != null) result.number = number;
    if (positionMs != null) result.positionMs = positionMs;
    return result;
  }

  ReportPositionRequest._();

  factory ReportPositionRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportPositionRequest()..mergeFromBuffer(data, registry);
  factory ReportPositionRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportPositionRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReportPositionRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReportPositionRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aInt64(2, _omitFieldNames ? '' : 'positionMs')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportPositionRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportPositionRequest copyWith(
          void Function(ReportPositionRequest) updates) =>
      super.copyWith((message) => updates(message as ReportPositionRequest))
          as ReportPositionRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ReportPositionRequest() / ReportPositionRequest.new instead')
  static ReportPositionRequest create() => ReportPositionRequest._();
  static $pb.GeneratedMessage $_createMessage() => ReportPositionRequest._();
  @$core.override
  ReportPositionRequest createEmptyInstance() => ReportPositionRequest._();
  @$core.pragma('dart2js:noInline')
  static ReportPositionRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ReportPositionRequest>(
          ReportPositionRequest.$_createMessage);
  static ReportPositionRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  $fixnum.Int64 get positionMs => $_getI64(1);
  @$pb.TagNumber(2)
  set positionMs($fixnum.Int64 value) => $_setInt64(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPositionMs() => $_has(1);
  @$pb.TagNumber(2)
  void clearPositionMs() => $_clearField(2);
}

/// Empty.
class ReportPositionResponse extends $pb.GeneratedMessage {
  factory ReportPositionResponse() => ReportPositionResponse._();

  ReportPositionResponse._();

  factory ReportPositionResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportPositionResponse()..mergeFromBuffer(data, registry);
  factory ReportPositionResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportPositionResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReportPositionResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReportPositionResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportPositionResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportPositionResponse copyWith(
          void Function(ReportPositionResponse) updates) =>
      super.copyWith((message) => updates(message as ReportPositionResponse))
          as ReportPositionResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ReportPositionResponse() / ReportPositionResponse.new instead')
  static ReportPositionResponse create() => ReportPositionResponse._();
  static $pb.GeneratedMessage $_createMessage() => ReportPositionResponse._();
  @$core.override
  ReportPositionResponse createEmptyInstance() => ReportPositionResponse._();
  @$core.pragma('dart2js:noInline')
  static ReportPositionResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ReportPositionResponse>(
          ReportPositionResponse.$_createMessage);
  static ReportPositionResponse? _defaultInstance;
}

/// The song that ended and how many microphone readings were loud.
class EndedRequest extends $pb.GeneratedMessage {
  factory EndedRequest({
    $core.String? number,
    $core.int? loudReadings,
  }) {
    final result = EndedRequest._();
    if (number != null) result.number = number;
    if (loudReadings != null) result.loudReadings = loudReadings;
    return result;
  }

  EndedRequest._();

  factory EndedRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      EndedRequest()..mergeFromBuffer(data, registry);
  factory EndedRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      EndedRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'EndedRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: EndedRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aI(2, _omitFieldNames ? '' : 'loudReadings')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  EndedRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  EndedRequest copyWith(void Function(EndedRequest) updates) =>
      super.copyWith((message) => updates(message as EndedRequest))
          as EndedRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use EndedRequest() / EndedRequest.new instead')
  static EndedRequest create() => EndedRequest._();
  static $pb.GeneratedMessage $_createMessage() => EndedRequest._();
  @$core.override
  EndedRequest createEmptyInstance() => EndedRequest._();
  @$core.pragma('dart2js:noInline')
  static EndedRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<EndedRequest>(
          EndedRequest.$_createMessage);
  static EndedRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get loudReadings => $_getIZ(1);
  @$pb.TagNumber(2)
  set loudReadings($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasLoudReadings() => $_has(1);
  @$pb.TagNumber(2)
  void clearLoudReadings() => $_clearField(2);
}

/// Empty.
class EndedResponse extends $pb.GeneratedMessage {
  factory EndedResponse() => EndedResponse._();

  EndedResponse._();

  factory EndedResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      EndedResponse()..mergeFromBuffer(data, registry);
  factory EndedResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      EndedResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'EndedResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: EndedResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  EndedResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  EndedResponse copyWith(void Function(EndedResponse) updates) =>
      super.copyWith((message) => updates(message as EndedResponse))
          as EndedResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use EndedResponse() / EndedResponse.new instead')
  static EndedResponse create() => EndedResponse._();
  static $pb.GeneratedMessage $_createMessage() => EndedResponse._();
  @$core.override
  EndedResponse createEmptyInstance() => EndedResponse._();
  @$core.pragma('dart2js:noInline')
  static EndedResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<EndedResponse>(
          EndedResponse.$_createMessage);
  static EndedResponse? _defaultInstance;
}

/// True when the device has a usable microphone.
class ReportMicRequest extends $pb.GeneratedMessage {
  factory ReportMicRequest({
    $core.bool? available,
  }) {
    final result = ReportMicRequest._();
    if (available != null) result.available = available;
    return result;
  }

  ReportMicRequest._();

  factory ReportMicRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportMicRequest()..mergeFromBuffer(data, registry);
  factory ReportMicRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportMicRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReportMicRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReportMicRequest.$_createMessage)
    ..aOB(1, _omitFieldNames ? '' : 'available')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportMicRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportMicRequest copyWith(void Function(ReportMicRequest) updates) =>
      super.copyWith((message) => updates(message as ReportMicRequest))
          as ReportMicRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ReportMicRequest() / ReportMicRequest.new instead')
  static ReportMicRequest create() => ReportMicRequest._();
  static $pb.GeneratedMessage $_createMessage() => ReportMicRequest._();
  @$core.override
  ReportMicRequest createEmptyInstance() => ReportMicRequest._();
  @$core.pragma('dart2js:noInline')
  static ReportMicRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ReportMicRequest>(
          ReportMicRequest.$_createMessage);
  static ReportMicRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.bool get available => $_getBF(0);
  @$pb.TagNumber(1)
  set available($core.bool value) => $_setBool(0, value);
  @$pb.TagNumber(1)
  $core.bool hasAvailable() => $_has(0);
  @$pb.TagNumber(1)
  void clearAvailable() => $_clearField(1);
}

/// Empty.
class ReportMicResponse extends $pb.GeneratedMessage {
  factory ReportMicResponse() => ReportMicResponse._();

  ReportMicResponse._();

  factory ReportMicResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportMicResponse()..mergeFromBuffer(data, registry);
  factory ReportMicResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportMicResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReportMicResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReportMicResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportMicResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportMicResponse copyWith(void Function(ReportMicResponse) updates) =>
      super.copyWith((message) => updates(message as ReportMicResponse))
          as ReportMicResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ReportMicResponse() / ReportMicResponse.new instead')
  static ReportMicResponse create() => ReportMicResponse._();
  static $pb.GeneratedMessage $_createMessage() => ReportMicResponse._();
  @$core.override
  ReportMicResponse createEmptyInstance() => ReportMicResponse._();
  @$core.pragma('dart2js:noInline')
  static ReportMicResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<ReportMicResponse>(
          ReportMicResponse.$_createMessage);
  static ReportMicResponse? _defaultInstance;
}

/// Device facts: memory in MB and how many audio dropouts were seen.
class ReportDeviceRequest extends $pb.GeneratedMessage {
  factory ReportDeviceRequest({
    $core.int? memoryMb,
    $core.int? dropouts,
  }) {
    final result = ReportDeviceRequest._();
    if (memoryMb != null) result.memoryMb = memoryMb;
    if (dropouts != null) result.dropouts = dropouts;
    return result;
  }

  ReportDeviceRequest._();

  factory ReportDeviceRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportDeviceRequest()..mergeFromBuffer(data, registry);
  factory ReportDeviceRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportDeviceRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReportDeviceRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReportDeviceRequest.$_createMessage)
    ..aI(1, _omitFieldNames ? '' : 'memoryMb')
    ..aI(2, _omitFieldNames ? '' : 'dropouts')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportDeviceRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportDeviceRequest copyWith(void Function(ReportDeviceRequest) updates) =>
      super.copyWith((message) => updates(message as ReportDeviceRequest))
          as ReportDeviceRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use ReportDeviceRequest() / ReportDeviceRequest.new instead')
  static ReportDeviceRequest create() => ReportDeviceRequest._();
  static $pb.GeneratedMessage $_createMessage() => ReportDeviceRequest._();
  @$core.override
  ReportDeviceRequest createEmptyInstance() => ReportDeviceRequest._();
  @$core.pragma('dart2js:noInline')
  static ReportDeviceRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ReportDeviceRequest>(
          ReportDeviceRequest.$_createMessage);
  static ReportDeviceRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.int get memoryMb => $_getIZ(0);
  @$pb.TagNumber(1)
  set memoryMb($core.int value) => $_setSignedInt32(0, value);
  @$pb.TagNumber(1)
  $core.bool hasMemoryMb() => $_has(0);
  @$pb.TagNumber(1)
  void clearMemoryMb() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get dropouts => $_getIZ(1);
  @$pb.TagNumber(2)
  set dropouts($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasDropouts() => $_has(1);
  @$pb.TagNumber(2)
  void clearDropouts() => $_clearField(2);
}

/// The calling device.
class ReportDeviceResponse extends $pb.GeneratedMessage {
  factory ReportDeviceResponse({
    $0.Device? device,
  }) {
    final result = ReportDeviceResponse._();
    if (device != null) result.device = device;
    return result;
  }

  ReportDeviceResponse._();

  factory ReportDeviceResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportDeviceResponse()..mergeFromBuffer(data, registry);
  factory ReportDeviceResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ReportDeviceResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ReportDeviceResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ReportDeviceResponse.$_createMessage)
    ..aOM<$0.Device>(1, _omitFieldNames ? '' : 'device',
        subBuilder: $0.Device.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportDeviceResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ReportDeviceResponse copyWith(void Function(ReportDeviceResponse) updates) =>
      super.copyWith((message) => updates(message as ReportDeviceResponse))
          as ReportDeviceResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ReportDeviceResponse() / ReportDeviceResponse.new instead')
  static ReportDeviceResponse create() => ReportDeviceResponse._();
  static $pb.GeneratedMessage $_createMessage() => ReportDeviceResponse._();
  @$core.override
  ReportDeviceResponse createEmptyInstance() => ReportDeviceResponse._();
  @$core.pragma('dart2js:noInline')
  static ReportDeviceResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ReportDeviceResponse>(
          ReportDeviceResponse.$_createMessage);
  static ReportDeviceResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.Device get device => $_getN(0);
  @$pb.TagNumber(1)
  set device($0.Device value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasDevice() => $_has(0);
  @$pb.TagNumber(1)
  void clearDevice() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.Device ensureDevice() => $_ensure(0);
}

/// The device and the mode to set.
class SetMidiModeRequest extends $pb.GeneratedMessage {
  factory SetMidiModeRequest({
    $core.String? deviceId,
    $0.MidiMode? mode,
  }) {
    final result = SetMidiModeRequest._();
    if (deviceId != null) result.deviceId = deviceId;
    if (mode != null) result.mode = mode;
    return result;
  }

  SetMidiModeRequest._();

  factory SetMidiModeRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetMidiModeRequest()..mergeFromBuffer(data, registry);
  factory SetMidiModeRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetMidiModeRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SetMidiModeRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SetMidiModeRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'deviceId')
    ..aE<$0.MidiMode>(2, _omitFieldNames ? '' : 'mode',
        enumValues: $0.MidiMode.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetMidiModeRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetMidiModeRequest copyWith(void Function(SetMidiModeRequest) updates) =>
      super.copyWith((message) => updates(message as SetMidiModeRequest))
          as SetMidiModeRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use SetMidiModeRequest() / SetMidiModeRequest.new instead')
  static SetMidiModeRequest create() => SetMidiModeRequest._();
  static $pb.GeneratedMessage $_createMessage() => SetMidiModeRequest._();
  @$core.override
  SetMidiModeRequest createEmptyInstance() => SetMidiModeRequest._();
  @$core.pragma('dart2js:noInline')
  static SetMidiModeRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<SetMidiModeRequest>(
          SetMidiModeRequest.$_createMessage);
  static SetMidiModeRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get deviceId => $_getSZ(0);
  @$pb.TagNumber(1)
  set deviceId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasDeviceId() => $_has(0);
  @$pb.TagNumber(1)
  void clearDeviceId() => $_clearField(1);

  @$pb.TagNumber(2)
  $0.MidiMode get mode => $_getN(1);
  @$pb.TagNumber(2)
  set mode($0.MidiMode value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasMode() => $_has(1);
  @$pb.TagNumber(2)
  void clearMode() => $_clearField(2);
}

/// The device after the change.
class SetMidiModeResponse extends $pb.GeneratedMessage {
  factory SetMidiModeResponse({
    $0.Device? device,
  }) {
    final result = SetMidiModeResponse._();
    if (device != null) result.device = device;
    return result;
  }

  SetMidiModeResponse._();

  factory SetMidiModeResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetMidiModeResponse()..mergeFromBuffer(data, registry);
  factory SetMidiModeResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetMidiModeResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SetMidiModeResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SetMidiModeResponse.$_createMessage)
    ..aOM<$0.Device>(1, _omitFieldNames ? '' : 'device',
        subBuilder: $0.Device.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetMidiModeResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetMidiModeResponse copyWith(void Function(SetMidiModeResponse) updates) =>
      super.copyWith((message) => updates(message as SetMidiModeResponse))
          as SetMidiModeResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use SetMidiModeResponse() / SetMidiModeResponse.new instead')
  static SetMidiModeResponse create() => SetMidiModeResponse._();
  static $pb.GeneratedMessage $_createMessage() => SetMidiModeResponse._();
  @$core.override
  SetMidiModeResponse createEmptyInstance() => SetMidiModeResponse._();
  @$core.pragma('dart2js:noInline')
  static SetMidiModeResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<SetMidiModeResponse>(
          SetMidiModeResponse.$_createMessage);
  static SetMidiModeResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.Device get device => $_getN(0);
  @$pb.TagNumber(1)
  set device($0.Device value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasDevice() => $_has(0);
  @$pb.TagNumber(1)
  void clearDevice() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.Device ensureDevice() => $_ensure(0);
}

/// One entry of the caller's queue.
class QueueItem extends $pb.GeneratedMessage {
  factory QueueItem({
    $core.String? id,
    $0.Song? song,
  }) {
    final result = QueueItem._();
    if (id != null) result.id = id;
    if (song != null) result.song = song;
    return result;
  }

  QueueItem._();

  factory QueueItem.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      QueueItem()..mergeFromBuffer(data, registry);
  factory QueueItem.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      QueueItem()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'QueueItem',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: QueueItem.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOM<$0.Song>(2, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  QueueItem clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  QueueItem copyWith(void Function(QueueItem) updates) =>
      super.copyWith((message) => updates(message as QueueItem)) as QueueItem;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use QueueItem() / QueueItem.new instead')
  static QueueItem create() => QueueItem._();
  static $pb.GeneratedMessage $_createMessage() => QueueItem._();
  @$core.override
  QueueItem createEmptyInstance() => QueueItem._();
  @$core.pragma('dart2js:noInline')
  static QueueItem getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<QueueItem>(QueueItem.$_createMessage);
  static QueueItem? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);

  @$pb.TagNumber(2)
  $0.Song get song => $_getN(1);
  @$pb.TagNumber(2)
  set song($0.Song value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasSong() => $_has(1);
  @$pb.TagNumber(2)
  void clearSong() => $_clearField(2);
  @$pb.TagNumber(2)
  $0.Song ensureSong() => $_ensure(1);
}

/// The current song; remotes extrapolate position from position_at_ms (server clock).
class NowPlaying extends $pb.GeneratedMessage {
  factory NowPlaying({
    $0.Song? song,
    SongSource? source,
    $fixnum.Int64? positionMs,
    $fixnum.Int64? positionAtMs,
  }) {
    final result = NowPlaying._();
    if (song != null) result.song = song;
    if (source != null) result.source = source;
    if (positionMs != null) result.positionMs = positionMs;
    if (positionAtMs != null) result.positionAtMs = positionAtMs;
    return result;
  }

  NowPlaying._();

  factory NowPlaying.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      NowPlaying()..mergeFromBuffer(data, registry);
  factory NowPlaying.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      NowPlaying()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'NowPlaying',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: NowPlaying.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..aE<SongSource>(2, _omitFieldNames ? '' : 'source',
        enumValues: SongSource.values)
    ..aInt64(3, _omitFieldNames ? '' : 'positionMs')
    ..aInt64(4, _omitFieldNames ? '' : 'positionAtMs')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  NowPlaying clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  NowPlaying copyWith(void Function(NowPlaying) updates) =>
      super.copyWith((message) => updates(message as NowPlaying)) as NowPlaying;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use NowPlaying() / NowPlaying.new instead')
  static NowPlaying create() => NowPlaying._();
  static $pb.GeneratedMessage $_createMessage() => NowPlaying._();
  @$core.override
  NowPlaying createEmptyInstance() => NowPlaying._();
  @$core.pragma('dart2js:noInline')
  static NowPlaying getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<NowPlaying>(NowPlaying.$_createMessage);
  static NowPlaying? _defaultInstance;

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

  @$pb.TagNumber(2)
  SongSource get source => $_getN(1);
  @$pb.TagNumber(2)
  set source(SongSource value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasSource() => $_has(1);
  @$pb.TagNumber(2)
  void clearSource() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get positionMs => $_getI64(2);
  @$pb.TagNumber(3)
  set positionMs($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasPositionMs() => $_has(2);
  @$pb.TagNumber(3)
  void clearPositionMs() => $_clearField(3);

  @$pb.TagNumber(4)
  $fixnum.Int64 get positionAtMs => $_getI64(3);
  @$pb.TagNumber(4)
  set positionAtMs($fixnum.Int64 value) => $_setInt64(3, value);
  @$pb.TagNumber(4)
  $core.bool hasPositionAtMs() => $_has(3);
  @$pb.TagNumber(4)
  void clearPositionAtMs() => $_clearField(4);
}

/// The song that follows the current one, pre-picked when the current one starts.
class UpNext extends $pb.GeneratedMessage {
  factory UpNext({
    $0.Song? song,
    SongSource? source,
  }) {
    final result = UpNext._();
    if (song != null) result.song = song;
    if (source != null) result.source = source;
    return result;
  }

  UpNext._();

  factory UpNext.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpNext()..mergeFromBuffer(data, registry);
  factory UpNext.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpNext()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpNext',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpNext.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..aE<SongSource>(2, _omitFieldNames ? '' : 'source',
        enumValues: SongSource.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpNext clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpNext copyWith(void Function(UpNext) updates) =>
      super.copyWith((message) => updates(message as UpNext)) as UpNext;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UpNext() / UpNext.new instead')
  static UpNext create() => UpNext._();
  static $pb.GeneratedMessage $_createMessage() => UpNext._();
  @$core.override
  UpNext createEmptyInstance() => UpNext._();
  @$core.pragma('dart2js:noInline')
  static UpNext getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpNext>(UpNext.$_createMessage);
  static UpNext? _defaultInstance;

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

  @$pb.TagNumber(2)
  SongSource get source => $_getN(1);
  @$pb.TagNumber(2)
  set source(SongSource value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasSource() => $_has(1);
  @$pb.TagNumber(2)
  void clearSource() => $_clearField(2);
}

/// The caller's score settings.
class UserSettings extends $pb.GeneratedMessage {
  factory UserSettings({
    ScoreMode? scoreMode,
    ScoreLevel? scoreLevel,
  }) {
    final result = UserSettings._();
    if (scoreMode != null) result.scoreMode = scoreMode;
    if (scoreLevel != null) result.scoreLevel = scoreLevel;
    return result;
  }

  UserSettings._();

  factory UserSettings.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UserSettings()..mergeFromBuffer(data, registry);
  factory UserSettings.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UserSettings()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UserSettings',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UserSettings.$_createMessage)
    ..aE<ScoreMode>(1, _omitFieldNames ? '' : 'scoreMode',
        enumValues: ScoreMode.values)
    ..aE<ScoreLevel>(2, _omitFieldNames ? '' : 'scoreLevel',
        enumValues: ScoreLevel.values)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UserSettings clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UserSettings copyWith(void Function(UserSettings) updates) =>
      super.copyWith((message) => updates(message as UserSettings))
          as UserSettings;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UserSettings() / UserSettings.new instead')
  static UserSettings create() => UserSettings._();
  static $pb.GeneratedMessage $_createMessage() => UserSettings._();
  @$core.override
  UserSettings createEmptyInstance() => UserSettings._();
  @$core.pragma('dart2js:noInline')
  static UserSettings getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<UserSettings>(
          UserSettings.$_createMessage);
  static UserSettings? _defaultInstance;

  @$pb.TagNumber(1)
  ScoreMode get scoreMode => $_getN(0);
  @$pb.TagNumber(1)
  set scoreMode(ScoreMode value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasScoreMode() => $_has(0);
  @$pb.TagNumber(1)
  void clearScoreMode() => $_clearField(1);

  @$pb.TagNumber(2)
  ScoreLevel get scoreLevel => $_getN(1);
  @$pb.TagNumber(2)
  set scoreLevel(ScoreLevel value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasScoreLevel() => $_has(1);
  @$pb.TagNumber(2)
  void clearScoreLevel() => $_clearField(2);
}

/// The score shown after a song until until_ms; fanfare is 0 for none or 1 to 3.
class Score extends $pb.GeneratedMessage {
  factory Score({
    $core.String? number,
    $core.bool? hasValue,
    $core.int? value_3,
    $core.String? comment,
    $core.int? fanfare,
    $core.String? reason,
    $fixnum.Int64? untilMs,
  }) {
    final result = Score._();
    if (number != null) result.number = number;
    if (hasValue != null) result.hasValue = hasValue;
    if (value_3 != null) result.value_3 = value_3;
    if (comment != null) result.comment = comment;
    if (fanfare != null) result.fanfare = fanfare;
    if (reason != null) result.reason = reason;
    if (untilMs != null) result.untilMs = untilMs;
    return result;
  }

  Score._();

  factory Score.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Score()..mergeFromBuffer(data, registry);
  factory Score.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Score()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Score',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Score.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aOB(2, _omitFieldNames ? '' : 'hasValue')
    ..aI(3, _omitFieldNames ? '' : 'value')
    ..aOS(4, _omitFieldNames ? '' : 'comment')
    ..aI(5, _omitFieldNames ? '' : 'fanfare')
    ..aOS(6, _omitFieldNames ? '' : 'reason')
    ..aInt64(7, _omitFieldNames ? '' : 'untilMs')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Score clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Score copyWith(void Function(Score) updates) =>
      super.copyWith((message) => updates(message as Score)) as Score;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Score() / Score.new instead')
  static Score create() => Score._();
  static $pb.GeneratedMessage $_createMessage() => Score._();
  @$core.override
  Score createEmptyInstance() => Score._();
  @$core.pragma('dart2js:noInline')
  static Score getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Score>(Score.$_createMessage);
  static Score? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.bool get hasValue => $_getBF(1);
  @$pb.TagNumber(2)
  set hasValue($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasHasValue() => $_has(1);
  @$pb.TagNumber(2)
  void clearHasValue() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get value_3 => $_getIZ(2);
  @$pb.TagNumber(3)
  set value_3($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasValue_3() => $_has(2);
  @$pb.TagNumber(3)
  void clearValue_3() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get comment => $_getSZ(3);
  @$pb.TagNumber(4)
  set comment($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasComment() => $_has(3);
  @$pb.TagNumber(4)
  void clearComment() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.int get fanfare => $_getIZ(4);
  @$pb.TagNumber(5)
  set fanfare($core.int value) => $_setSignedInt32(4, value);
  @$pb.TagNumber(5)
  $core.bool hasFanfare() => $_has(4);
  @$pb.TagNumber(5)
  void clearFanfare() => $_clearField(5);

  @$pb.TagNumber(6)
  $core.String get reason => $_getSZ(5);
  @$pb.TagNumber(6)
  set reason($core.String value) => $_setString(5, value);
  @$pb.TagNumber(6)
  $core.bool hasReason() => $_has(5);
  @$pb.TagNumber(6)
  void clearReason() => $_clearField(6);

  @$pb.TagNumber(7)
  $fixnum.Int64 get untilMs => $_getI64(6);
  @$pb.TagNumber(7)
  set untilMs($fixnum.Int64 value) => $_setInt64(6, value);
  @$pb.TagNumber(7)
  $core.bool hasUntilMs() => $_has(6);
  @$pb.TagNumber(7)
  void clearUntilMs() => $_clearField(7);
}

/// Everything one user's devices need to show; score is unset when no score is showing.
class State extends $pb.GeneratedMessage {
  factory State({
    PlayStatus? status,
    $core.String? playerDeviceId,
    $core.Iterable<$0.Device>? devices,
    NowPlaying? now,
    $core.Iterable<QueueItem>? queue,
    UpNext? upNext,
    UserSettings? settings,
    Score? score,
    $fixnum.Int64? serverTimeMs,
  }) {
    final result = State._();
    if (status != null) result.status = status;
    if (playerDeviceId != null) result.playerDeviceId = playerDeviceId;
    if (devices != null) result.devices.addAll(devices);
    if (now != null) result.now = now;
    if (queue != null) result.queue.addAll(queue);
    if (upNext != null) result.upNext = upNext;
    if (settings != null) result.settings = settings;
    if (score != null) result.score = score;
    if (serverTimeMs != null) result.serverTimeMs = serverTimeMs;
    return result;
  }

  State._();

  factory State.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      State()..mergeFromBuffer(data, registry);
  factory State.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      State()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'State',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: State.$_createMessage)
    ..aE<PlayStatus>(1, _omitFieldNames ? '' : 'status',
        enumValues: PlayStatus.values)
    ..aOS(2, _omitFieldNames ? '' : 'playerDeviceId')
    ..pPM<$0.Device>(3, _omitFieldNames ? '' : 'devices',
        subBuilder: $0.Device.$_createMessage)
    ..aOM<NowPlaying>(4, _omitFieldNames ? '' : 'now',
        subBuilder: NowPlaying.$_createMessage)
    ..pPM<QueueItem>(5, _omitFieldNames ? '' : 'queue',
        subBuilder: QueueItem.$_createMessage)
    ..aOM<UpNext>(6, _omitFieldNames ? '' : 'upNext',
        subBuilder: UpNext.$_createMessage)
    ..aOM<UserSettings>(7, _omitFieldNames ? '' : 'settings',
        subBuilder: UserSettings.$_createMessage)
    ..aOM<Score>(8, _omitFieldNames ? '' : 'score',
        subBuilder: Score.$_createMessage)
    ..aInt64(9, _omitFieldNames ? '' : 'serverTimeMs')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  State clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  State copyWith(void Function(State) updates) =>
      super.copyWith((message) => updates(message as State)) as State;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use State() / State.new instead')
  static State create() => State._();
  static $pb.GeneratedMessage $_createMessage() => State._();
  @$core.override
  State createEmptyInstance() => State._();
  @$core.pragma('dart2js:noInline')
  static State getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<State>(State.$_createMessage);
  static State? _defaultInstance;

  @$pb.TagNumber(1)
  PlayStatus get status => $_getN(0);
  @$pb.TagNumber(1)
  set status(PlayStatus value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasStatus() => $_has(0);
  @$pb.TagNumber(1)
  void clearStatus() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get playerDeviceId => $_getSZ(1);
  @$pb.TagNumber(2)
  set playerDeviceId($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPlayerDeviceId() => $_has(1);
  @$pb.TagNumber(2)
  void clearPlayerDeviceId() => $_clearField(2);

  @$pb.TagNumber(3)
  $pb.PbList<$0.Device> get devices => $_getList(2);

  @$pb.TagNumber(4)
  NowPlaying get now => $_getN(3);
  @$pb.TagNumber(4)
  set now(NowPlaying value) => $_setField(4, value);
  @$pb.TagNumber(4)
  $core.bool hasNow() => $_has(3);
  @$pb.TagNumber(4)
  void clearNow() => $_clearField(4);
  @$pb.TagNumber(4)
  NowPlaying ensureNow() => $_ensure(3);

  @$pb.TagNumber(5)
  $pb.PbList<QueueItem> get queue => $_getList(4);

  @$pb.TagNumber(6)
  UpNext get upNext => $_getN(5);
  @$pb.TagNumber(6)
  set upNext(UpNext value) => $_setField(6, value);
  @$pb.TagNumber(6)
  $core.bool hasUpNext() => $_has(5);
  @$pb.TagNumber(6)
  void clearUpNext() => $_clearField(6);
  @$pb.TagNumber(6)
  UpNext ensureUpNext() => $_ensure(5);

  @$pb.TagNumber(7)
  UserSettings get settings => $_getN(6);
  @$pb.TagNumber(7)
  set settings(UserSettings value) => $_setField(7, value);
  @$pb.TagNumber(7)
  $core.bool hasSettings() => $_has(6);
  @$pb.TagNumber(7)
  void clearSettings() => $_clearField(7);
  @$pb.TagNumber(7)
  UserSettings ensureSettings() => $_ensure(6);

  @$pb.TagNumber(8)
  Score get score => $_getN(7);
  @$pb.TagNumber(8)
  set score(Score value) => $_setField(8, value);
  @$pb.TagNumber(8)
  $core.bool hasScore() => $_has(7);
  @$pb.TagNumber(8)
  void clearScore() => $_clearField(8);
  @$pb.TagNumber(8)
  Score ensureScore() => $_ensure(7);

  @$pb.TagNumber(9)
  $fixnum.Int64 get serverTimeMs => $_getI64(8);
  @$pb.TagNumber(9)
  set serverTimeMs($fixnum.Int64 value) => $_setInt64(8, value);
  @$pb.TagNumber(9)
  $core.bool hasServerTimeMs() => $_has(8);
  @$pb.TagNumber(9)
  void clearServerTimeMs() => $_clearField(9);
}

/// Per-user playback state; every RPC acts on the calling user only, never on another user's queue (plan 7).
class SessionServiceApi {
  final $pb.RpcClient _client;

  SessionServiceApi(this._client);

  /// Signed-in user. Streams the caller's full State at once and after every change (positions never push).
  $async.Future<WatchStateResponse> watchState(
          $pb.ClientContext? ctx, WatchStateRequest request) =>
      _client.invoke<WatchStateResponse>(
          ctx, 'SessionService', 'WatchState', request, WatchStateResponse());

  /// Signed-in user. Polling fallback for WatchState.
  $async.Future<GetStateResponse> getState(
          $pb.ClientContext? ctx, GetStateRequest request) =>
      _client.invoke<GetStateResponse>(
          ctx, 'SessionService', 'GetState', request, GetStateResponse());

  /// Signed-in user. Appends to the caller's queue and never interrupts the current song; NOT_FOUND for an unknown number.
  $async.Future<AddToQueueResponse> addToQueue(
          $pb.ClientContext? ctx, AddToQueueRequest request) =>
      _client.invoke<AddToQueueResponse>(
          ctx, 'SessionService', 'AddToQueue', request, AddToQueueResponse());

  /// Signed-in user. Appends a playlist the caller owns; returns how many songs were added.
  $async.Future<AddPlaylistToQueueResponse> addPlaylistToQueue(
          $pb.ClientContext? ctx, AddPlaylistToQueueRequest request) =>
      _client.invoke<AddPlaylistToQueueResponse>(ctx, 'SessionService',
          'AddPlaylistToQueue', request, AddPlaylistToQueueResponse());

  /// Signed-in user. Removes one of the caller's queue items; NOT_FOUND for an unknown item.
  $async.Future<RemoveFromQueueResponse> removeFromQueue(
          $pb.ClientContext? ctx, RemoveFromQueueRequest request) =>
      _client.invoke<RemoveFromQueueResponse>(ctx, 'SessionService',
          'RemoveFromQueue', request, RemoveFromQueueResponse());

  /// Signed-in user. Moves one of the caller's queue items to the front; NOT_FOUND for an unknown item.
  $async.Future<MoveToTopResponse> moveToTop(
          $pb.ClientContext? ctx, MoveToTopRequest request) =>
      _client.invoke<MoveToTopResponse>(
          ctx, 'SessionService', 'MoveToTop', request, MoveToTopResponse());

  /// Signed-in user. PLAY_HERE makes the calling device the player; PLAY resumes on the current player; PAUSE and SKIP act from any device.
  $async.Future<ControlResponse> control(
          $pb.ClientContext? ctx, ControlRequest request) =>
      _client.invoke<ControlResponse>(
          ctx, 'SessionService', 'Control', request, ControlResponse());

  /// Signed-in user. Unset optional fields are left unchanged.
  $async.Future<UpdateUserSettingsResponse> updateUserSettings(
          $pb.ClientContext? ctx, UpdateUserSettingsRequest request) =>
      _client.invoke<UpdateUserSettingsResponse>(ctx, 'SessionService',
          'UpdateUserSettings', request, UpdateUserSettingsResponse());

  /// Current player device only (FAILED_PRECONDITION otherwise): the song is loaded and can start.
  $async.Future<ReadyResponse> ready(
          $pb.ClientContext? ctx, ReadyRequest request) =>
      _client.invoke<ReadyResponse>(
          ctx, 'SessionService', 'Ready', request, ReadyResponse());

  /// Current player device only: position in memory, never pushed to watchers.
  $async.Future<ReportPositionResponse> reportPosition(
          $pb.ClientContext? ctx, ReportPositionRequest request) =>
      _client.invoke<ReportPositionResponse>(ctx, 'SessionService',
          'ReportPosition', request, ReportPositionResponse());

  /// Current player device only: the song ended on its own; loud_readings drive the microphone score.
  $async.Future<EndedResponse> ended(
          $pb.ClientContext? ctx, EndedRequest request) =>
      _client.invoke<EndedResponse>(
          ctx, 'SessionService', 'Ended', request, EndedResponse());

  /// Signed-in user. Whether the calling device has a usable microphone.
  $async.Future<ReportMicResponse> reportMic(
          $pb.ClientContext? ctx, ReportMicRequest request) =>
      _client.invoke<ReportMicResponse>(
          ctx, 'SessionService', 'ReportMic', request, ReportMicResponse());

  /// Signed-in user. Memory and dropouts of the calling device; returns the device with its effective MIDI mode.
  $async.Future<ReportDeviceResponse> reportDevice(
          $pb.ClientContext? ctx, ReportDeviceRequest request) =>
      _client.invoke<ReportDeviceResponse>(ctx, 'SessionService',
          'ReportDevice', request, ReportDeviceResponse());

  /// Signed-in user. Sets the MIDI mode of one of the caller's devices; NOT_FOUND for another user's device.
  $async.Future<SetMidiModeResponse> setMidiMode(
          $pb.ClientContext? ctx, SetMidiModeRequest request) =>
      _client.invoke<SetMidiModeResponse>(
          ctx, 'SessionService', 'SetMidiMode', request, SetMidiModeResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
