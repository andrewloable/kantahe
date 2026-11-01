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

import 'package:fixnum/fixnum.dart' as $fixnum;
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

/// The original filename and the size of the whole file in bytes.
class BeginVideoUploadRequest extends $pb.GeneratedMessage {
  factory BeginVideoUploadRequest({
    $core.String? filename,
    $fixnum.Int64? sizeBytes,
  }) {
    final result = BeginVideoUploadRequest._();
    if (filename != null) result.filename = filename;
    if (sizeBytes != null) result.sizeBytes = sizeBytes;
    return result;
  }

  BeginVideoUploadRequest._();

  factory BeginVideoUploadRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      BeginVideoUploadRequest()..mergeFromBuffer(data, registry);
  factory BeginVideoUploadRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      BeginVideoUploadRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'BeginVideoUploadRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: BeginVideoUploadRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'filename')
    ..aInt64(2, _omitFieldNames ? '' : 'sizeBytes')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  BeginVideoUploadRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  BeginVideoUploadRequest copyWith(
          void Function(BeginVideoUploadRequest) updates) =>
      super.copyWith((message) => updates(message as BeginVideoUploadRequest))
          as BeginVideoUploadRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use BeginVideoUploadRequest() / BeginVideoUploadRequest.new instead')
  static BeginVideoUploadRequest create() => BeginVideoUploadRequest._();
  static $pb.GeneratedMessage $_createMessage() => BeginVideoUploadRequest._();
  @$core.override
  BeginVideoUploadRequest createEmptyInstance() => BeginVideoUploadRequest._();
  @$core.pragma('dart2js:noInline')
  static BeginVideoUploadRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<BeginVideoUploadRequest>(
          BeginVideoUploadRequest.$_createMessage);
  static BeginVideoUploadRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get filename => $_getSZ(0);
  @$pb.TagNumber(1)
  set filename($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasFilename() => $_has(0);
  @$pb.TagNumber(1)
  void clearFilename() => $_clearField(1);

  @$pb.TagNumber(2)
  $fixnum.Int64 get sizeBytes => $_getI64(1);
  @$pb.TagNumber(2)
  set sizeBytes($fixnum.Int64 value) => $_setInt64(1, value);
  @$pb.TagNumber(2)
  $core.bool hasSizeBytes() => $_has(1);
  @$pb.TagNumber(2)
  void clearSizeBytes() => $_clearField(2);
}

/// upload_id names the upload in the next calls; chunk_size is the largest chunk the server accepts.
class BeginVideoUploadResponse extends $pb.GeneratedMessage {
  factory BeginVideoUploadResponse({
    $core.String? uploadId,
    $core.int? chunkSize,
    $fixnum.Int64? received,
    UploadStatus? status,
    $core.String? reason,
  }) {
    final result = BeginVideoUploadResponse._();
    if (uploadId != null) result.uploadId = uploadId;
    if (chunkSize != null) result.chunkSize = chunkSize;
    if (received != null) result.received = received;
    if (status != null) result.status = status;
    if (reason != null) result.reason = reason;
    return result;
  }

  BeginVideoUploadResponse._();

  factory BeginVideoUploadResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      BeginVideoUploadResponse()..mergeFromBuffer(data, registry);
  factory BeginVideoUploadResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      BeginVideoUploadResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'BeginVideoUploadResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: BeginVideoUploadResponse.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'uploadId')
    ..aI(2, _omitFieldNames ? '' : 'chunkSize')
    ..aInt64(3, _omitFieldNames ? '' : 'received')
    ..aE<UploadStatus>(4, _omitFieldNames ? '' : 'status',
        enumValues: UploadStatus.values)
    ..aOS(5, _omitFieldNames ? '' : 'reason')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  BeginVideoUploadResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  BeginVideoUploadResponse copyWith(
          void Function(BeginVideoUploadResponse) updates) =>
      super.copyWith((message) => updates(message as BeginVideoUploadResponse))
          as BeginVideoUploadResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use BeginVideoUploadResponse() / BeginVideoUploadResponse.new instead')
  static BeginVideoUploadResponse create() => BeginVideoUploadResponse._();
  static $pb.GeneratedMessage $_createMessage() => BeginVideoUploadResponse._();
  @$core.override
  BeginVideoUploadResponse createEmptyInstance() =>
      BeginVideoUploadResponse._();
  @$core.pragma('dart2js:noInline')
  static BeginVideoUploadResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<BeginVideoUploadResponse>(
          BeginVideoUploadResponse.$_createMessage);
  static BeginVideoUploadResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get uploadId => $_getSZ(0);
  @$pb.TagNumber(1)
  set uploadId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUploadId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUploadId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get chunkSize => $_getIZ(1);
  @$pb.TagNumber(2)
  set chunkSize($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasChunkSize() => $_has(1);
  @$pb.TagNumber(2)
  void clearChunkSize() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get received => $_getI64(2);
  @$pb.TagNumber(3)
  set received($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasReceived() => $_has(2);
  @$pb.TagNumber(3)
  void clearReceived() => $_clearField(3);

  @$pb.TagNumber(4)
  UploadStatus get status => $_getN(3);
  @$pb.TagNumber(4)
  set status(UploadStatus value) => $_setField(4, value);
  @$pb.TagNumber(4)
  $core.bool hasStatus() => $_has(3);
  @$pb.TagNumber(4)
  void clearStatus() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.String get reason => $_getSZ(4);
  @$pb.TagNumber(5)
  set reason($core.String value) => $_setString(4, value);
  @$pb.TagNumber(5)
  $core.bool hasReason() => $_has(4);
  @$pb.TagNumber(5)
  void clearReason() => $_clearField(5);
}

/// The bytes at offset of the file; offset must equal the bytes received so far.
class UploadVideoChunkRequest extends $pb.GeneratedMessage {
  factory UploadVideoChunkRequest({
    $core.String? uploadId,
    $fixnum.Int64? offset,
    $core.List<$core.int>? content,
  }) {
    final result = UploadVideoChunkRequest._();
    if (uploadId != null) result.uploadId = uploadId;
    if (offset != null) result.offset = offset;
    if (content != null) result.content = content;
    return result;
  }

  UploadVideoChunkRequest._();

  factory UploadVideoChunkRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadVideoChunkRequest()..mergeFromBuffer(data, registry);
  factory UploadVideoChunkRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadVideoChunkRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UploadVideoChunkRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UploadVideoChunkRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'uploadId')
    ..aInt64(2, _omitFieldNames ? '' : 'offset')
    ..a<$core.List<$core.int>>(
        3, _omitFieldNames ? '' : 'content', $pb.PbFieldType.OY)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadVideoChunkRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadVideoChunkRequest copyWith(
          void Function(UploadVideoChunkRequest) updates) =>
      super.copyWith((message) => updates(message as UploadVideoChunkRequest))
          as UploadVideoChunkRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UploadVideoChunkRequest() / UploadVideoChunkRequest.new instead')
  static UploadVideoChunkRequest create() => UploadVideoChunkRequest._();
  static $pb.GeneratedMessage $_createMessage() => UploadVideoChunkRequest._();
  @$core.override
  UploadVideoChunkRequest createEmptyInstance() => UploadVideoChunkRequest._();
  @$core.pragma('dart2js:noInline')
  static UploadVideoChunkRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UploadVideoChunkRequest>(
          UploadVideoChunkRequest.$_createMessage);
  static UploadVideoChunkRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get uploadId => $_getSZ(0);
  @$pb.TagNumber(1)
  set uploadId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUploadId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUploadId() => $_clearField(1);

  @$pb.TagNumber(2)
  $fixnum.Int64 get offset => $_getI64(1);
  @$pb.TagNumber(2)
  set offset($fixnum.Int64 value) => $_setInt64(1, value);
  @$pb.TagNumber(2)
  $core.bool hasOffset() => $_has(1);
  @$pb.TagNumber(2)
  void clearOffset() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.List<$core.int> get content => $_getN(2);
  @$pb.TagNumber(3)
  set content($core.List<$core.int> value) => $_setBytes(2, value);
  @$pb.TagNumber(3)
  $core.bool hasContent() => $_has(2);
  @$pb.TagNumber(3)
  void clearContent() => $_clearField(3);
}

/// The bytes received so far.
class UploadVideoChunkResponse extends $pb.GeneratedMessage {
  factory UploadVideoChunkResponse({
    $fixnum.Int64? received,
  }) {
    final result = UploadVideoChunkResponse._();
    if (received != null) result.received = received;
    return result;
  }

  UploadVideoChunkResponse._();

  factory UploadVideoChunkResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadVideoChunkResponse()..mergeFromBuffer(data, registry);
  factory UploadVideoChunkResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UploadVideoChunkResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UploadVideoChunkResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UploadVideoChunkResponse.$_createMessage)
    ..aInt64(1, _omitFieldNames ? '' : 'received')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadVideoChunkResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UploadVideoChunkResponse copyWith(
          void Function(UploadVideoChunkResponse) updates) =>
      super.copyWith((message) => updates(message as UploadVideoChunkResponse))
          as UploadVideoChunkResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UploadVideoChunkResponse() / UploadVideoChunkResponse.new instead')
  static UploadVideoChunkResponse create() => UploadVideoChunkResponse._();
  static $pb.GeneratedMessage $_createMessage() => UploadVideoChunkResponse._();
  @$core.override
  UploadVideoChunkResponse createEmptyInstance() =>
      UploadVideoChunkResponse._();
  @$core.pragma('dart2js:noInline')
  static UploadVideoChunkResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UploadVideoChunkResponse>(
          UploadVideoChunkResponse.$_createMessage);
  static UploadVideoChunkResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $fixnum.Int64 get received => $_getI64(0);
  @$pb.TagNumber(1)
  set received($fixnum.Int64 value) => $_setInt64(0, value);
  @$pb.TagNumber(1)
  $core.bool hasReceived() => $_has(0);
  @$pb.TagNumber(1)
  void clearReceived() => $_clearField(1);
}

/// The upload to finish.
class CompleteVideoUploadRequest extends $pb.GeneratedMessage {
  factory CompleteVideoUploadRequest({
    $core.String? uploadId,
  }) {
    final result = CompleteVideoUploadRequest._();
    if (uploadId != null) result.uploadId = uploadId;
    return result;
  }

  CompleteVideoUploadRequest._();

  factory CompleteVideoUploadRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CompleteVideoUploadRequest()..mergeFromBuffer(data, registry);
  factory CompleteVideoUploadRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CompleteVideoUploadRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CompleteVideoUploadRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CompleteVideoUploadRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'uploadId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CompleteVideoUploadRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CompleteVideoUploadRequest copyWith(
          void Function(CompleteVideoUploadRequest) updates) =>
      super.copyWith(
              (message) => updates(message as CompleteVideoUploadRequest))
          as CompleteVideoUploadRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use CompleteVideoUploadRequest() / CompleteVideoUploadRequest.new instead')
  static CompleteVideoUploadRequest create() => CompleteVideoUploadRequest._();
  static $pb.GeneratedMessage $_createMessage() =>
      CompleteVideoUploadRequest._();
  @$core.override
  CompleteVideoUploadRequest createEmptyInstance() =>
      CompleteVideoUploadRequest._();
  @$core.pragma('dart2js:noInline')
  static CompleteVideoUploadRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CompleteVideoUploadRequest>(
          CompleteVideoUploadRequest.$_createMessage);
  static CompleteVideoUploadRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get uploadId => $_getSZ(0);
  @$pb.TagNumber(1)
  set uploadId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUploadId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUploadId() => $_clearField(1);
}

/// status ADDED carries the video, REJECTED carries the reason, DUPLICATE carries the existing video.
class CompleteVideoUploadResponse extends $pb.GeneratedMessage {
  factory CompleteVideoUploadResponse({
    UploadStatus? status,
    $0.Video? video,
    $core.String? reason,
  }) {
    final result = CompleteVideoUploadResponse._();
    if (status != null) result.status = status;
    if (video != null) result.video = video;
    if (reason != null) result.reason = reason;
    return result;
  }

  CompleteVideoUploadResponse._();

  factory CompleteVideoUploadResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CompleteVideoUploadResponse()..mergeFromBuffer(data, registry);
  factory CompleteVideoUploadResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CompleteVideoUploadResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CompleteVideoUploadResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CompleteVideoUploadResponse.$_createMessage)
    ..aE<UploadStatus>(1, _omitFieldNames ? '' : 'status',
        enumValues: UploadStatus.values)
    ..aOM<$0.Video>(2, _omitFieldNames ? '' : 'video',
        subBuilder: $0.Video.$_createMessage)
    ..aOS(3, _omitFieldNames ? '' : 'reason')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CompleteVideoUploadResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CompleteVideoUploadResponse copyWith(
          void Function(CompleteVideoUploadResponse) updates) =>
      super.copyWith(
              (message) => updates(message as CompleteVideoUploadResponse))
          as CompleteVideoUploadResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use CompleteVideoUploadResponse() / CompleteVideoUploadResponse.new instead')
  static CompleteVideoUploadResponse create() =>
      CompleteVideoUploadResponse._();
  static $pb.GeneratedMessage $_createMessage() =>
      CompleteVideoUploadResponse._();
  @$core.override
  CompleteVideoUploadResponse createEmptyInstance() =>
      CompleteVideoUploadResponse._();
  @$core.pragma('dart2js:noInline')
  static CompleteVideoUploadResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CompleteVideoUploadResponse>(
          CompleteVideoUploadResponse.$_createMessage);
  static CompleteVideoUploadResponse? _defaultInstance;

  @$pb.TagNumber(1)
  UploadStatus get status => $_getN(0);
  @$pb.TagNumber(1)
  set status(UploadStatus value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasStatus() => $_has(0);
  @$pb.TagNumber(1)
  void clearStatus() => $_clearField(1);

  @$pb.TagNumber(2)
  $0.Video get video => $_getN(1);
  @$pb.TagNumber(2)
  set video($0.Video value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasVideo() => $_has(1);
  @$pb.TagNumber(2)
  void clearVideo() => $_clearField(2);
  @$pb.TagNumber(2)
  $0.Video ensureVideo() => $_ensure(1);

  @$pb.TagNumber(3)
  $core.String get reason => $_getSZ(2);
  @$pb.TagNumber(3)
  set reason($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasReason() => $_has(2);
  @$pb.TagNumber(3)
  void clearReason() => $_clearField(3);
}

/// The upload to throw away.
class AbortVideoUploadRequest extends $pb.GeneratedMessage {
  factory AbortVideoUploadRequest({
    $core.String? uploadId,
  }) {
    final result = AbortVideoUploadRequest._();
    if (uploadId != null) result.uploadId = uploadId;
    return result;
  }

  AbortVideoUploadRequest._();

  factory AbortVideoUploadRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AbortVideoUploadRequest()..mergeFromBuffer(data, registry);
  factory AbortVideoUploadRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AbortVideoUploadRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AbortVideoUploadRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AbortVideoUploadRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'uploadId')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AbortVideoUploadRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AbortVideoUploadRequest copyWith(
          void Function(AbortVideoUploadRequest) updates) =>
      super.copyWith((message) => updates(message as AbortVideoUploadRequest))
          as AbortVideoUploadRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use AbortVideoUploadRequest() / AbortVideoUploadRequest.new instead')
  static AbortVideoUploadRequest create() => AbortVideoUploadRequest._();
  static $pb.GeneratedMessage $_createMessage() => AbortVideoUploadRequest._();
  @$core.override
  AbortVideoUploadRequest createEmptyInstance() => AbortVideoUploadRequest._();
  @$core.pragma('dart2js:noInline')
  static AbortVideoUploadRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<AbortVideoUploadRequest>(
          AbortVideoUploadRequest.$_createMessage);
  static AbortVideoUploadRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get uploadId => $_getSZ(0);
  @$pb.TagNumber(1)
  set uploadId($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasUploadId() => $_has(0);
  @$pb.TagNumber(1)
  void clearUploadId() => $_clearField(1);
}

/// Nothing to report.
class AbortVideoUploadResponse extends $pb.GeneratedMessage {
  factory AbortVideoUploadResponse() => AbortVideoUploadResponse._();

  AbortVideoUploadResponse._();

  factory AbortVideoUploadResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AbortVideoUploadResponse()..mergeFromBuffer(data, registry);
  factory AbortVideoUploadResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AbortVideoUploadResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AbortVideoUploadResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AbortVideoUploadResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AbortVideoUploadResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AbortVideoUploadResponse copyWith(
          void Function(AbortVideoUploadResponse) updates) =>
      super.copyWith((message) => updates(message as AbortVideoUploadResponse))
          as AbortVideoUploadResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use AbortVideoUploadResponse() / AbortVideoUploadResponse.new instead')
  static AbortVideoUploadResponse create() => AbortVideoUploadResponse._();
  static $pb.GeneratedMessage $_createMessage() => AbortVideoUploadResponse._();
  @$core.override
  AbortVideoUploadResponse createEmptyInstance() =>
      AbortVideoUploadResponse._();
  @$core.pragma('dart2js:noInline')
  static AbortVideoUploadResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<AbortVideoUploadResponse>(
          AbortVideoUploadResponse.$_createMessage);
  static AbortVideoUploadResponse? _defaultInstance;
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

  /// Admin only. Starts, or resumes, the upload of one background video: a video is too big for one message, so it goes up in chunks of
  /// unary calls (D3). REJECTED with a reason when the name, the size or the limit is refused; received > 0 when an earlier upload of the same file by the same admin is resumed.
  $async.Future<BeginVideoUploadResponse> beginVideoUpload(
          $pb.ClientContext? ctx, BeginVideoUploadRequest request) =>
      _client.invoke<BeginVideoUploadResponse>(ctx, 'UploadService',
          'BeginVideoUpload', request, BeginVideoUploadResponse());

  /// Admin only. One chunk of at most 4 MiB at the offset the server expects next (INVALID_ARGUMENT otherwise); returns the bytes received so far.
  $async.Future<UploadVideoChunkResponse> uploadVideoChunk(
          $pb.ClientContext? ctx, UploadVideoChunkRequest request) =>
      _client.invoke<UploadVideoChunkResponse>(ctx, 'UploadService',
          'UploadVideoChunk', request, UploadVideoChunkResponse());

  /// Admin only. Checks the whole file (an MP4 with an H.264 video track) and adds it to the end of the loop; rejections are reported in the response, not as errors.
  $async.Future<CompleteVideoUploadResponse> completeVideoUpload(
          $pb.ClientContext? ctx, CompleteVideoUploadRequest request) =>
      _client.invoke<CompleteVideoUploadResponse>(ctx, 'UploadService',
          'CompleteVideoUpload', request, CompleteVideoUploadResponse());

  /// Admin only. Throws away what was received of an unfinished upload.
  $async.Future<AbortVideoUploadResponse> abortVideoUpload(
          $pb.ClientContext? ctx, AbortVideoUploadRequest request) =>
      _client.invoke<AbortVideoUploadResponse>(ctx, 'UploadService',
          'AbortVideoUpload', request, AbortVideoUploadResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
