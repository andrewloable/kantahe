// This is a generated file - do not edit.
//
// Generated from kantahe/v1/upload.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'common.pb.dart' as $0;
import 'upload.pbenum.dart';

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

export 'upload.pbenum.dart';

/// The original filename (its leading digits become the song number) and the file bytes (at most the configured limit).
class UploadSongRequest extends $pb.GeneratedMessage {
  factory UploadSongRequest({
    $core.String? filename,
    $core.List<$core.int>? content,
  }) {
    final result = UploadSongRequest._();
    if (filename != null) result.filename = filename;
    if (content != null) result.content = content;
    return result;
  }

  UploadSongRequest._();

  factory UploadSongRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadSongRequest()..mergeFromBuffer(data, registry);
  factory UploadSongRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadSongRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UploadSongRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UploadSongRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'filename')
    ..a<$core.List<$core.int>>(
        2, _omitFieldNames ? '' : 'content', $pb.PbFieldType.OY)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadSongRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadSongRequest copyWith(void Function(UploadSongRequest) updates) =>
      super.copyWith((message) => updates(message as UploadSongRequest))
          as UploadSongRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UploadSongRequest() / UploadSongRequest.new instead')
  static UploadSongRequest create() => UploadSongRequest._();
  static $pb.GeneratedMessage $_createMessage() => UploadSongRequest._();
  @$core.override
  UploadSongRequest createEmptyInstance() => UploadSongRequest._();
  @$core.pragma('dart2js:noInline')
  static UploadSongRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<UploadSongRequest>(
          UploadSongRequest.$_createMessage);
  static UploadSongRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get filename => $_getSZ(0);
  @$pb.TagNumber(1)
  set filename($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFilename() => $_has(0);
  @$pb.TagNumber(1)
  void clearFilename() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.List<$core.int> get content => $_getN(1);
  @$pb.TagNumber(2)
  set content($core.List<$core.int> value) => $_setBytes(1, value);
  @$pb.TagNumber(2)
  $core.bool hasContent() => $_has(1);
  @$pb.TagNumber(2)
  void clearContent() => $_clearField(2);
}

/// status ADDED carries the song, REJECTED carries the reason, DUPLICATE carries the existing song.
class UploadSongResponse extends $pb.GeneratedMessage {
  factory UploadSongResponse({
    UploadStatus? status,
    $0.Song? song,
    $core.String? reason,
  }) {
    final result = UploadSongResponse._();
    if (status != null) result.status = status;
    if (song != null) result.song = song;
    if (reason != null) result.reason = reason;
    return result;
  }

  UploadSongResponse._();

  factory UploadSongResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadSongResponse()..mergeFromBuffer(data, registry);
  factory UploadSongResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadSongResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UploadSongResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UploadSongResponse.$_createMessage)
    ..aE<UploadStatus>(1, _omitFieldNames ? '' : 'status',
        enumValues: UploadStatus.values)
    ..aOM<$0.Song>(2, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..aOS(3, _omitFieldNames ? '' : 'reason')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadSongResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadSongResponse copyWith(void Function(UploadSongResponse) updates) =>
      super.copyWith((message) => updates(message as UploadSongResponse))
          as UploadSongResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use UploadSongResponse() / UploadSongResponse.new instead')
  static UploadSongResponse create() => UploadSongResponse._();
  static $pb.GeneratedMessage $_createMessage() => UploadSongResponse._();
  @$core.override
  UploadSongResponse createEmptyInstance() => UploadSongResponse._();
  @$core.pragma('dart2js:noInline')
  static UploadSongResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UploadSongResponse>(
          UploadSongResponse.$_createMessage);
  static UploadSongResponse? _defaultInstance;

  @$pb.TagNumber(1)
  UploadStatus get status => $_getN(0);
  @$pb.TagNumber(1)
  set status(UploadStatus value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasStatus() => $_has(0);
  @$pb.TagNumber(1)
  void clearStatus() => $_clearField(1);

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

  @$pb.TagNumber(3)
  $core.String get reason => $_getSZ(2);
  @$pb.TagNumber(3)
  set reason($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasReason() => $_has(2);
  @$pb.TagNumber(3)
  void clearReason() => $_clearField(3);
}

/// Song upload; requires the uploader role (PERMISSION_DENIED otherwise).
class UploadServiceApi {
  final $pb.RpcClient _client;

  UploadServiceApi(this._client);

  /// Uploader or admin. One .kar or .karmp3 per call (ZIPs are unpacked on the client); rejections are reported in the response, not as errors.
  $async.Future<UploadSongResponse> uploadSong(
          $pb.ClientContext? ctx, UploadSongRequest request) =>
      _client.invoke<UploadSongResponse>(
          ctx, 'UploadService', 'UploadSong', request, UploadSongResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
