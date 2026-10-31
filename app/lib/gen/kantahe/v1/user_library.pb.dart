// This is a generated file - do not edit.
//
// Generated from kantahe/v1/user_library.proto.

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

/// Adds or removes a favourite.
class SetFavouriteRequest extends $pb.GeneratedMessage {
  factory SetFavouriteRequest({
    $core.String? number,
    $core.bool? favourite,
  }) {
    final result = SetFavouriteRequest._();
    if (number != null) result.number = number;
    if (favourite != null) result.favourite = favourite;
    return result;
  }

  SetFavouriteRequest._();

  factory SetFavouriteRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetFavouriteRequest()..mergeFromBuffer(data, registry);
  factory SetFavouriteRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetFavouriteRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SetFavouriteRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SetFavouriteRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aOB(2, _omitFieldNames ? '' : 'favourite')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetFavouriteRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetFavouriteRequest copyWith(void Function(SetFavouriteRequest) updates) =>
      super.copyWith((message) => updates(message as SetFavouriteRequest))
          as SetFavouriteRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use SetFavouriteRequest() / SetFavouriteRequest.new instead')
  static SetFavouriteRequest create() => SetFavouriteRequest._();
  static $pb.GeneratedMessage $_createMessage() => SetFavouriteRequest._();
  @$core.override
  SetFavouriteRequest createEmptyInstance() => SetFavouriteRequest._();
  @$core.pragma('dart2js:noInline')
  static SetFavouriteRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<SetFavouriteRequest>(
          SetFavouriteRequest.$_createMessage);
  static SetFavouriteRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.bool get favourite => $_getBF(1);
  @$pb.TagNumber(2)
  set favourite($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasFavourite() => $_has(1);
  @$pb.TagNumber(2)
  void clearFavourite() => $_clearField(2);
}

/// Empty.
class SetFavouriteResponse extends $pb.GeneratedMessage {
  factory SetFavouriteResponse() => SetFavouriteResponse._();

  SetFavouriteResponse._();

  factory SetFavouriteResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetFavouriteResponse()..mergeFromBuffer(data, registry);
  factory SetFavouriteResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SetFavouriteResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SetFavouriteResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SetFavouriteResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetFavouriteResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SetFavouriteResponse copyWith(void Function(SetFavouriteResponse) updates) =>
      super.copyWith((message) => updates(message as SetFavouriteResponse))
          as SetFavouriteResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use SetFavouriteResponse() / SetFavouriteResponse.new instead')
  static SetFavouriteResponse create() => SetFavouriteResponse._();
  static $pb.GeneratedMessage $_createMessage() => SetFavouriteResponse._();
  @$core.override
  SetFavouriteResponse createEmptyInstance() => SetFavouriteResponse._();
  @$core.pragma('dart2js:noInline')
  static SetFavouriteResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<SetFavouriteResponse>(
          SetFavouriteResponse.$_createMessage);
  static SetFavouriteResponse? _defaultInstance;
}

/// Paging only.
class ListFavouritesRequest extends $pb.GeneratedMessage {
  factory ListFavouritesRequest({
    $core.String? pageToken,
    $core.int? pageSize,
  }) {
    final result = ListFavouritesRequest._();
    if (pageToken != null) result.pageToken = pageToken;
    if (pageSize != null) result.pageSize = pageSize;
    return result;
  }

  ListFavouritesRequest._();

  factory ListFavouritesRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListFavouritesRequest()..mergeFromBuffer(data, registry);
  factory ListFavouritesRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListFavouritesRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListFavouritesRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListFavouritesRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'pageToken')
    ..aI(2, _omitFieldNames ? '' : 'pageSize')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListFavouritesRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListFavouritesRequest copyWith(
          void Function(ListFavouritesRequest) updates) =>
      super.copyWith((message) => updates(message as ListFavouritesRequest))
          as ListFavouritesRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListFavouritesRequest() / ListFavouritesRequest.new instead')
  static ListFavouritesRequest create() => ListFavouritesRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListFavouritesRequest._();
  @$core.override
  ListFavouritesRequest createEmptyInstance() => ListFavouritesRequest._();
  @$core.pragma('dart2js:noInline')
  static ListFavouritesRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListFavouritesRequest>(
          ListFavouritesRequest.$_createMessage);
  static ListFavouritesRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get pageToken => $_getSZ(0);
  @$pb.TagNumber(1)
  set pageToken($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasPageToken() => $_has(0);
  @$pb.TagNumber(1)
  void clearPageToken() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get pageSize => $_getIZ(1);
  @$pb.TagNumber(2)
  set pageSize($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPageSize() => $_has(1);
  @$pb.TagNumber(2)
  void clearPageSize() => $_clearField(2);
}

/// One page of favourites.
class ListFavouritesResponse extends $pb.GeneratedMessage {
  factory ListFavouritesResponse({
    $core.Iterable<$0.Song>? songs,
    $core.String? nextPageToken,
  }) {
    final result = ListFavouritesResponse._();
    if (songs != null) result.songs.addAll(songs);
    if (nextPageToken != null) result.nextPageToken = nextPageToken;
    return result;
  }

  ListFavouritesResponse._();

  factory ListFavouritesResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListFavouritesResponse()..mergeFromBuffer(data, registry);
  factory ListFavouritesResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListFavouritesResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListFavouritesResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListFavouritesResponse.$_createMessage)
    ..pPM<$0.Song>(1, _omitFieldNames ? '' : 'songs',
        subBuilder: $0.Song.$_createMessage)
    ..aOS(2, _omitFieldNames ? '' : 'nextPageToken')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListFavouritesResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListFavouritesResponse copyWith(
          void Function(ListFavouritesResponse) updates) =>
      super.copyWith((message) => updates(message as ListFavouritesResponse))
          as ListFavouritesResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListFavouritesResponse() / ListFavouritesResponse.new instead')
  static ListFavouritesResponse create() => ListFavouritesResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListFavouritesResponse._();
  @$core.override
  ListFavouritesResponse createEmptyInstance() => ListFavouritesResponse._();
  @$core.pragma('dart2js:noInline')
  static ListFavouritesResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListFavouritesResponse>(
          ListFavouritesResponse.$_createMessage);
  static ListFavouritesResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<$0.Song> get songs => $_getList(0);

  @$pb.TagNumber(2)
  $core.String get nextPageToken => $_getSZ(1);
  @$pb.TagNumber(2)
  set nextPageToken($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasNextPageToken() => $_has(1);
  @$pb.TagNumber(2)
  void clearNextPageToken() => $_clearField(2);
}

/// Paging only.
class ListHistoryRequest extends $pb.GeneratedMessage {
  factory ListHistoryRequest({
    $core.String? pageToken,
    $core.int? pageSize,
  }) {
    final result = ListHistoryRequest._();
    if (pageToken != null) result.pageToken = pageToken;
    if (pageSize != null) result.pageSize = pageSize;
    return result;
  }

  ListHistoryRequest._();

  factory ListHistoryRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListHistoryRequest()..mergeFromBuffer(data, registry);
  factory ListHistoryRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListHistoryRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListHistoryRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListHistoryRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'pageToken')
    ..aI(2, _omitFieldNames ? '' : 'pageSize')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListHistoryRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListHistoryRequest copyWith(void Function(ListHistoryRequest) updates) =>
      super.copyWith((message) => updates(message as ListHistoryRequest))
          as ListHistoryRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ListHistoryRequest() / ListHistoryRequest.new instead')
  static ListHistoryRequest create() => ListHistoryRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListHistoryRequest._();
  @$core.override
  ListHistoryRequest createEmptyInstance() => ListHistoryRequest._();
  @$core.pragma('dart2js:noInline')
  static ListHistoryRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListHistoryRequest>(
          ListHistoryRequest.$_createMessage);
  static ListHistoryRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get pageToken => $_getSZ(0);
  @$pb.TagNumber(1)
  set pageToken($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasPageToken() => $_has(0);
  @$pb.TagNumber(1)
  void clearPageToken() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get pageSize => $_getIZ(1);
  @$pb.TagNumber(2)
  set pageSize($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPageSize() => $_has(1);
  @$pb.TagNumber(2)
  void clearPageSize() => $_clearField(2);
}

/// One sung (or skipped) song; has_score is false for skipped songs and when scoring is off.
class HistoryEntry extends $pb.GeneratedMessage {
  factory HistoryEntry({
    $0.Song? song,
    $fixnum.Int64? sungAtUnix,
    $core.bool? skipped,
    $core.bool? hasScore,
    $core.int? score_5,
  }) {
    final result = HistoryEntry._();
    if (song != null) result.song = song;
    if (sungAtUnix != null) result.sungAtUnix = sungAtUnix;
    if (skipped != null) result.skipped = skipped;
    if (hasScore != null) result.hasScore = hasScore;
    if (score_5 != null) result.score_5 = score_5;
    return result;
  }

  HistoryEntry._();

  factory HistoryEntry.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      HistoryEntry()..mergeFromBuffer(data, registry);
  factory HistoryEntry.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      HistoryEntry()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'HistoryEntry',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: HistoryEntry.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..aInt64(2, _omitFieldNames ? '' : 'sungAtUnix')
    ..aOB(3, _omitFieldNames ? '' : 'skipped')
    ..aOB(4, _omitFieldNames ? '' : 'hasScore')
    ..aI(5, _omitFieldNames ? '' : 'score')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  HistoryEntry clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  HistoryEntry copyWith(void Function(HistoryEntry) updates) =>
      super.copyWith((message) => updates(message as HistoryEntry))
          as HistoryEntry;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use HistoryEntry() / HistoryEntry.new instead')
  static HistoryEntry create() => HistoryEntry._();
  static $pb.GeneratedMessage $_createMessage() => HistoryEntry._();
  @$core.override
  HistoryEntry createEmptyInstance() => HistoryEntry._();
  @$core.pragma('dart2js:noInline')
  static HistoryEntry getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<HistoryEntry>(
          HistoryEntry.$_createMessage);
  static HistoryEntry? _defaultInstance;

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
  $fixnum.Int64 get sungAtUnix => $_getI64(1);
  @$pb.TagNumber(2)
  set sungAtUnix($fixnum.Int64 value) => $_setInt64(1, value);
  @$pb.TagNumber(2)
  $core.bool hasSungAtUnix() => $_has(1);
  @$pb.TagNumber(2)
  void clearSungAtUnix() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.bool get skipped => $_getBF(2);
  @$pb.TagNumber(3)
  set skipped($core.bool value) => $_setBool(2, value);
  @$pb.TagNumber(3)
  $core.bool hasSkipped() => $_has(2);
  @$pb.TagNumber(3)
  void clearSkipped() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get hasScore => $_getBF(3);
  @$pb.TagNumber(4)
  set hasScore($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasHasScore() => $_has(3);
  @$pb.TagNumber(4)
  void clearHasScore() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.int get score_5 => $_getIZ(4);
  @$pb.TagNumber(5)
  set score_5($core.int value) => $_setSignedInt32(4, value);
  @$pb.TagNumber(5)
  $core.bool hasScore_5() => $_has(4);
  @$pb.TagNumber(5)
  void clearScore_5() => $_clearField(5);
}

/// One page of history.
class ListHistoryResponse extends $pb.GeneratedMessage {
  factory ListHistoryResponse({
    $core.Iterable<HistoryEntry>? entries,
    $core.String? nextPageToken,
  }) {
    final result = ListHistoryResponse._();
    if (entries != null) result.entries.addAll(entries);
    if (nextPageToken != null) result.nextPageToken = nextPageToken;
    return result;
  }

  ListHistoryResponse._();

  factory ListHistoryResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListHistoryResponse()..mergeFromBuffer(data, registry);
  factory ListHistoryResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListHistoryResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListHistoryResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListHistoryResponse.$_createMessage)
    ..pPM<HistoryEntry>(1, _omitFieldNames ? '' : 'entries',
        subBuilder: HistoryEntry.$_createMessage)
    ..aOS(2, _omitFieldNames ? '' : 'nextPageToken')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListHistoryResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListHistoryResponse copyWith(void Function(ListHistoryResponse) updates) =>
      super.copyWith((message) => updates(message as ListHistoryResponse))
          as ListHistoryResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use ListHistoryResponse() / ListHistoryResponse.new instead')
  static ListHistoryResponse create() => ListHistoryResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListHistoryResponse._();
  @$core.override
  ListHistoryResponse createEmptyInstance() => ListHistoryResponse._();
  @$core.pragma('dart2js:noInline')
  static ListHistoryResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListHistoryResponse>(
          ListHistoryResponse.$_createMessage);
  static ListHistoryResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<HistoryEntry> get entries => $_getList(0);

  @$pb.TagNumber(2)
  $core.String get nextPageToken => $_getSZ(1);
  @$pb.TagNumber(2)
  set nextPageToken($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasNextPageToken() => $_has(1);
  @$pb.TagNumber(2)
  void clearNextPageToken() => $_clearField(2);
}

/// Asks nothing.
class ListPlaylistsRequest extends $pb.GeneratedMessage {
  factory ListPlaylistsRequest() => ListPlaylistsRequest._();

  ListPlaylistsRequest._();

  factory ListPlaylistsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListPlaylistsRequest()..mergeFromBuffer(data, registry);
  factory ListPlaylistsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListPlaylistsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListPlaylistsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListPlaylistsRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListPlaylistsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListPlaylistsRequest copyWith(void Function(ListPlaylistsRequest) updates) =>
      super.copyWith((message) => updates(message as ListPlaylistsRequest))
          as ListPlaylistsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListPlaylistsRequest() / ListPlaylistsRequest.new instead')
  static ListPlaylistsRequest create() => ListPlaylistsRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListPlaylistsRequest._();
  @$core.override
  ListPlaylistsRequest createEmptyInstance() => ListPlaylistsRequest._();
  @$core.pragma('dart2js:noInline')
  static ListPlaylistsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListPlaylistsRequest>(
          ListPlaylistsRequest.$_createMessage);
  static ListPlaylistsRequest? _defaultInstance;
}

/// A playlist without its songs.
class PlaylistSummary extends $pb.GeneratedMessage {
  factory PlaylistSummary({
    $core.String? id,
    $core.String? name,
    $core.int? songCount,
  }) {
    final result = PlaylistSummary._();
    if (id != null) result.id = id;
    if (name != null) result.name = name;
    if (songCount != null) result.songCount = songCount;
    return result;
  }

  PlaylistSummary._();

  factory PlaylistSummary.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      PlaylistSummary()..mergeFromBuffer(data, registry);
  factory PlaylistSummary.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      PlaylistSummary()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'PlaylistSummary',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: PlaylistSummary.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOS(2, _omitFieldNames ? '' : 'name')
    ..aI(3, _omitFieldNames ? '' : 'songCount')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  PlaylistSummary clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  PlaylistSummary copyWith(void Function(PlaylistSummary) updates) =>
      super.copyWith((message) => updates(message as PlaylistSummary))
          as PlaylistSummary;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use PlaylistSummary() / PlaylistSummary.new instead')
  static PlaylistSummary create() => PlaylistSummary._();
  static $pb.GeneratedMessage $_createMessage() => PlaylistSummary._();
  @$core.override
  PlaylistSummary createEmptyInstance() => PlaylistSummary._();
  @$core.pragma('dart2js:noInline')
  static PlaylistSummary getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<PlaylistSummary>(
          PlaylistSummary.$_createMessage);
  static PlaylistSummary? _defaultInstance;

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
  $core.int get songCount => $_getIZ(2);
  @$pb.TagNumber(3)
  set songCount($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasSongCount() => $_has(2);
  @$pb.TagNumber(3)
  void clearSongCount() => $_clearField(3);
}

/// The caller's playlists.
class ListPlaylistsResponse extends $pb.GeneratedMessage {
  factory ListPlaylistsResponse({
    $core.Iterable<PlaylistSummary>? playlists,
  }) {
    final result = ListPlaylistsResponse._();
    if (playlists != null) result.playlists.addAll(playlists);
    return result;
  }

  ListPlaylistsResponse._();

  factory ListPlaylistsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListPlaylistsResponse()..mergeFromBuffer(data, registry);
  factory ListPlaylistsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListPlaylistsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListPlaylistsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListPlaylistsResponse.$_createMessage)
    ..pPM<PlaylistSummary>(1, _omitFieldNames ? '' : 'playlists',
        subBuilder: PlaylistSummary.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListPlaylistsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListPlaylistsResponse copyWith(
          void Function(ListPlaylistsResponse) updates) =>
      super.copyWith((message) => updates(message as ListPlaylistsResponse))
          as ListPlaylistsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use ListPlaylistsResponse() / ListPlaylistsResponse.new instead')
  static ListPlaylistsResponse create() => ListPlaylistsResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListPlaylistsResponse._();
  @$core.override
  ListPlaylistsResponse createEmptyInstance() => ListPlaylistsResponse._();
  @$core.pragma('dart2js:noInline')
  static ListPlaylistsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListPlaylistsResponse>(
          ListPlaylistsResponse.$_createMessage);
  static ListPlaylistsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<PlaylistSummary> get playlists => $_getList(0);
}

/// The playlist to read.
class GetPlaylistRequest extends $pb.GeneratedMessage {
  factory GetPlaylistRequest({
    $core.String? id,
  }) {
    final result = GetPlaylistRequest._();
    if (id != null) result.id = id;
    return result;
  }

  GetPlaylistRequest._();

  factory GetPlaylistRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaylistRequest()..mergeFromBuffer(data, registry);
  factory GetPlaylistRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaylistRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetPlaylistRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetPlaylistRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaylistRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaylistRequest copyWith(void Function(GetPlaylistRequest) updates) =>
      super.copyWith((message) => updates(message as GetPlaylistRequest))
          as GetPlaylistRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetPlaylistRequest() / GetPlaylistRequest.new instead')
  static GetPlaylistRequest create() => GetPlaylistRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetPlaylistRequest._();
  @$core.override
  GetPlaylistRequest createEmptyInstance() => GetPlaylistRequest._();
  @$core.pragma('dart2js:noInline')
  static GetPlaylistRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetPlaylistRequest>(
          GetPlaylistRequest.$_createMessage);
  static GetPlaylistRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);
}

/// A playlist with its songs in order.
class Playlist extends $pb.GeneratedMessage {
  factory Playlist({
    $core.String? id,
    $core.String? name,
    $core.Iterable<$0.Song>? songs,
  }) {
    final result = Playlist._();
    if (id != null) result.id = id;
    if (name != null) result.name = name;
    if (songs != null) result.songs.addAll(songs);
    return result;
  }

  Playlist._();

  factory Playlist.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Playlist()..mergeFromBuffer(data, registry);
  factory Playlist.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Playlist()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Playlist',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Playlist.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOS(2, _omitFieldNames ? '' : 'name')
    ..pPM<$0.Song>(3, _omitFieldNames ? '' : 'songs',
        subBuilder: $0.Song.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Playlist clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Playlist copyWith(void Function(Playlist) updates) =>
      super.copyWith((message) => updates(message as Playlist)) as Playlist;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Playlist() / Playlist.new instead')
  static Playlist create() => Playlist._();
  static $pb.GeneratedMessage $_createMessage() => Playlist._();
  @$core.override
  Playlist createEmptyInstance() => Playlist._();
  @$core.pragma('dart2js:noInline')
  static Playlist getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Playlist>(Playlist.$_createMessage);
  static Playlist? _defaultInstance;

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
  $pb.PbList<$0.Song> get songs => $_getList(2);
}

/// The playlist.
class GetPlaylistResponse extends $pb.GeneratedMessage {
  factory GetPlaylistResponse({
    Playlist? playlist,
  }) {
    final result = GetPlaylistResponse._();
    if (playlist != null) result.playlist = playlist;
    return result;
  }

  GetPlaylistResponse._();

  factory GetPlaylistResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaylistResponse()..mergeFromBuffer(data, registry);
  factory GetPlaylistResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaylistResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetPlaylistResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetPlaylistResponse.$_createMessage)
    ..aOM<Playlist>(1, _omitFieldNames ? '' : 'playlist',
        subBuilder: Playlist.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaylistResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaylistResponse copyWith(void Function(GetPlaylistResponse) updates) =>
      super.copyWith((message) => updates(message as GetPlaylistResponse))
          as GetPlaylistResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use GetPlaylistResponse() / GetPlaylistResponse.new instead')
  static GetPlaylistResponse create() => GetPlaylistResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetPlaylistResponse._();
  @$core.override
  GetPlaylistResponse createEmptyInstance() => GetPlaylistResponse._();
  @$core.pragma('dart2js:noInline')
  static GetPlaylistResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetPlaylistResponse>(
          GetPlaylistResponse.$_createMessage);
  static GetPlaylistResponse? _defaultInstance;

  @$pb.TagNumber(1)
  Playlist get playlist => $_getN(0);
  @$pb.TagNumber(1)
  set playlist(Playlist value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasPlaylist() => $_has(0);
  @$pb.TagNumber(1)
  void clearPlaylist() => $_clearField(1);
  @$pb.TagNumber(1)
  Playlist ensurePlaylist() => $_ensure(0);
}

/// A new playlist with song numbers in order.
class CreatePlaylistRequest extends $pb.GeneratedMessage {
  factory CreatePlaylistRequest({
    $core.String? name,
    $core.Iterable<$core.String>? numbers,
  }) {
    final result = CreatePlaylistRequest._();
    if (name != null) result.name = name;
    if (numbers != null) result.numbers.addAll(numbers);
    return result;
  }

  CreatePlaylistRequest._();

  factory CreatePlaylistRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreatePlaylistRequest()..mergeFromBuffer(data, registry);
  factory CreatePlaylistRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreatePlaylistRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CreatePlaylistRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CreatePlaylistRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'name')
    ..pPS(2, _omitFieldNames ? '' : 'numbers')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreatePlaylistRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreatePlaylistRequest copyWith(
          void Function(CreatePlaylistRequest) updates) =>
      super.copyWith((message) => updates(message as CreatePlaylistRequest))
          as CreatePlaylistRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use CreatePlaylistRequest() / CreatePlaylistRequest.new instead')
  static CreatePlaylistRequest create() => CreatePlaylistRequest._();
  static $pb.GeneratedMessage $_createMessage() => CreatePlaylistRequest._();
  @$core.override
  CreatePlaylistRequest createEmptyInstance() => CreatePlaylistRequest._();
  @$core.pragma('dart2js:noInline')
  static CreatePlaylistRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CreatePlaylistRequest>(
          CreatePlaylistRequest.$_createMessage);
  static CreatePlaylistRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get name => $_getSZ(0);
  @$pb.TagNumber(1)
  set name($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasName() => $_has(0);
  @$pb.TagNumber(1)
  void clearName() => $_clearField(1);

  @$pb.TagNumber(2)
  $pb.PbList<$core.String> get numbers => $_getList(1);
}

/// The created playlist.
class CreatePlaylistResponse extends $pb.GeneratedMessage {
  factory CreatePlaylistResponse({
    Playlist? playlist,
  }) {
    final result = CreatePlaylistResponse._();
    if (playlist != null) result.playlist = playlist;
    return result;
  }

  CreatePlaylistResponse._();

  factory CreatePlaylistResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreatePlaylistResponse()..mergeFromBuffer(data, registry);
  factory CreatePlaylistResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      CreatePlaylistResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'CreatePlaylistResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: CreatePlaylistResponse.$_createMessage)
    ..aOM<Playlist>(1, _omitFieldNames ? '' : 'playlist',
        subBuilder: Playlist.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreatePlaylistResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  CreatePlaylistResponse copyWith(
          void Function(CreatePlaylistResponse) updates) =>
      super.copyWith((message) => updates(message as CreatePlaylistResponse))
          as CreatePlaylistResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use CreatePlaylistResponse() / CreatePlaylistResponse.new instead')
  static CreatePlaylistResponse create() => CreatePlaylistResponse._();
  static $pb.GeneratedMessage $_createMessage() => CreatePlaylistResponse._();
  @$core.override
  CreatePlaylistResponse createEmptyInstance() => CreatePlaylistResponse._();
  @$core.pragma('dart2js:noInline')
  static CreatePlaylistResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<CreatePlaylistResponse>(
          CreatePlaylistResponse.$_createMessage);
  static CreatePlaylistResponse? _defaultInstance;

  @$pb.TagNumber(1)
  Playlist get playlist => $_getN(0);
  @$pb.TagNumber(1)
  set playlist(Playlist value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasPlaylist() => $_has(0);
  @$pb.TagNumber(1)
  void clearPlaylist() => $_clearField(1);
  @$pb.TagNumber(1)
  Playlist ensurePlaylist() => $_ensure(0);
}

/// Rename and/or replace the songs.
class UpdatePlaylistRequest extends $pb.GeneratedMessage {
  factory UpdatePlaylistRequest({
    $core.String? id,
    $core.String? name,
    $core.bool? replaceNumbers,
    $core.Iterable<$core.String>? numbers,
  }) {
    final result = UpdatePlaylistRequest._();
    if (id != null) result.id = id;
    if (name != null) result.name = name;
    if (replaceNumbers != null) result.replaceNumbers = replaceNumbers;
    if (numbers != null) result.numbers.addAll(numbers);
    return result;
  }

  UpdatePlaylistRequest._();

  factory UpdatePlaylistRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdatePlaylistRequest()..mergeFromBuffer(data, registry);
  factory UpdatePlaylistRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdatePlaylistRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdatePlaylistRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdatePlaylistRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOS(2, _omitFieldNames ? '' : 'name')
    ..aOB(3, _omitFieldNames ? '' : 'replaceNumbers')
    ..pPS(4, _omitFieldNames ? '' : 'numbers')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdatePlaylistRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdatePlaylistRequest copyWith(
          void Function(UpdatePlaylistRequest) updates) =>
      super.copyWith((message) => updates(message as UpdatePlaylistRequest))
          as UpdatePlaylistRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UpdatePlaylistRequest() / UpdatePlaylistRequest.new instead')
  static UpdatePlaylistRequest create() => UpdatePlaylistRequest._();
  static $pb.GeneratedMessage $_createMessage() => UpdatePlaylistRequest._();
  @$core.override
  UpdatePlaylistRequest createEmptyInstance() => UpdatePlaylistRequest._();
  @$core.pragma('dart2js:noInline')
  static UpdatePlaylistRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdatePlaylistRequest>(
          UpdatePlaylistRequest.$_createMessage);
  static UpdatePlaylistRequest? _defaultInstance;

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
  $core.bool get replaceNumbers => $_getBF(2);
  @$pb.TagNumber(3)
  set replaceNumbers($core.bool value) => $_setBool(2, value);
  @$pb.TagNumber(3)
  $core.bool hasReplaceNumbers() => $_has(2);
  @$pb.TagNumber(3)
  void clearReplaceNumbers() => $_clearField(3);

  @$pb.TagNumber(4)
  $pb.PbList<$core.String> get numbers => $_getList(3);
}

/// The playlist after the update.
class UpdatePlaylistResponse extends $pb.GeneratedMessage {
  factory UpdatePlaylistResponse({
    Playlist? playlist,
  }) {
    final result = UpdatePlaylistResponse._();
    if (playlist != null) result.playlist = playlist;
    return result;
  }

  UpdatePlaylistResponse._();

  factory UpdatePlaylistResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdatePlaylistResponse()..mergeFromBuffer(data, registry);
  factory UpdatePlaylistResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      UpdatePlaylistResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'UpdatePlaylistResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: UpdatePlaylistResponse.$_createMessage)
    ..aOM<Playlist>(1, _omitFieldNames ? '' : 'playlist',
        subBuilder: Playlist.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdatePlaylistResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  UpdatePlaylistResponse copyWith(
          void Function(UpdatePlaylistResponse) updates) =>
      super.copyWith((message) => updates(message as UpdatePlaylistResponse))
          as UpdatePlaylistResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use UpdatePlaylistResponse() / UpdatePlaylistResponse.new instead')
  static UpdatePlaylistResponse create() => UpdatePlaylistResponse._();
  static $pb.GeneratedMessage $_createMessage() => UpdatePlaylistResponse._();
  @$core.override
  UpdatePlaylistResponse createEmptyInstance() => UpdatePlaylistResponse._();
  @$core.pragma('dart2js:noInline')
  static UpdatePlaylistResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<UpdatePlaylistResponse>(
          UpdatePlaylistResponse.$_createMessage);
  static UpdatePlaylistResponse? _defaultInstance;

  @$pb.TagNumber(1)
  Playlist get playlist => $_getN(0);
  @$pb.TagNumber(1)
  set playlist(Playlist value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasPlaylist() => $_has(0);
  @$pb.TagNumber(1)
  void clearPlaylist() => $_clearField(1);
  @$pb.TagNumber(1)
  Playlist ensurePlaylist() => $_ensure(0);
}

/// The playlist to delete.
class DeletePlaylistRequest extends $pb.GeneratedMessage {
  factory DeletePlaylistRequest({
    $core.String? id,
  }) {
    final result = DeletePlaylistRequest._();
    if (id != null) result.id = id;
    return result;
  }

  DeletePlaylistRequest._();

  factory DeletePlaylistRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeletePlaylistRequest()..mergeFromBuffer(data, registry);
  factory DeletePlaylistRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeletePlaylistRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeletePlaylistRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeletePlaylistRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeletePlaylistRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeletePlaylistRequest copyWith(
          void Function(DeletePlaylistRequest) updates) =>
      super.copyWith((message) => updates(message as DeletePlaylistRequest))
          as DeletePlaylistRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use DeletePlaylistRequest() / DeletePlaylistRequest.new instead')
  static DeletePlaylistRequest create() => DeletePlaylistRequest._();
  static $pb.GeneratedMessage $_createMessage() => DeletePlaylistRequest._();
  @$core.override
  DeletePlaylistRequest createEmptyInstance() => DeletePlaylistRequest._();
  @$core.pragma('dart2js:noInline')
  static DeletePlaylistRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeletePlaylistRequest>(
          DeletePlaylistRequest.$_createMessage);
  static DeletePlaylistRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);
}

/// Empty.
class DeletePlaylistResponse extends $pb.GeneratedMessage {
  factory DeletePlaylistResponse() => DeletePlaylistResponse._();

  DeletePlaylistResponse._();

  factory DeletePlaylistResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeletePlaylistResponse()..mergeFromBuffer(data, registry);
  factory DeletePlaylistResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      DeletePlaylistResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'DeletePlaylistResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: DeletePlaylistResponse.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeletePlaylistResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  DeletePlaylistResponse copyWith(
          void Function(DeletePlaylistResponse) updates) =>
      super.copyWith((message) => updates(message as DeletePlaylistResponse))
          as DeletePlaylistResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use DeletePlaylistResponse() / DeletePlaylistResponse.new instead')
  static DeletePlaylistResponse create() => DeletePlaylistResponse._();
  static $pb.GeneratedMessage $_createMessage() => DeletePlaylistResponse._();
  @$core.override
  DeletePlaylistResponse createEmptyInstance() => DeletePlaylistResponse._();
  @$core.pragma('dart2js:noInline')
  static DeletePlaylistResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<DeletePlaylistResponse>(
          DeletePlaylistResponse.$_createMessage);
  static DeletePlaylistResponse? _defaultInstance;
}

/// Favourites, history and playlists; always the calling user's own data.
class UserLibraryServiceApi {
  final $pb.RpcClient _client;

  UserLibraryServiceApi(this._client);

  /// Signed-in user; NOT_FOUND for an unknown song.
  $async.Future<SetFavouriteResponse> setFavourite(
          $pb.ClientContext? ctx, SetFavouriteRequest request) =>
      _client.invoke<SetFavouriteResponse>(ctx, 'UserLibraryService',
          'SetFavourite', request, SetFavouriteResponse());

  /// Signed-in user; the caller's favourites.
  $async.Future<ListFavouritesResponse> listFavourites(
          $pb.ClientContext? ctx, ListFavouritesRequest request) =>
      _client.invoke<ListFavouritesResponse>(ctx, 'UserLibraryService',
          'ListFavourites', request, ListFavouritesResponse());

  /// Signed-in user; the caller's sung songs.
  $async.Future<ListHistoryResponse> listHistory(
          $pb.ClientContext? ctx, ListHistoryRequest request) =>
      _client.invoke<ListHistoryResponse>(ctx, 'UserLibraryService',
          'ListHistory', request, ListHistoryResponse());

  /// Signed-in user; the caller's playlists.
  $async.Future<ListPlaylistsResponse> listPlaylists(
          $pb.ClientContext? ctx, ListPlaylistsRequest request) =>
      _client.invoke<ListPlaylistsResponse>(ctx, 'UserLibraryService',
          'ListPlaylists', request, ListPlaylistsResponse());

  /// Signed-in user; NOT_FOUND for another user's playlist.
  $async.Future<GetPlaylistResponse> getPlaylist(
          $pb.ClientContext? ctx, GetPlaylistRequest request) =>
      _client.invoke<GetPlaylistResponse>(ctx, 'UserLibraryService',
          'GetPlaylist', request, GetPlaylistResponse());

  /// Signed-in user; numbers that do not exist are rejected with INVALID_ARGUMENT.
  $async.Future<CreatePlaylistResponse> createPlaylist(
          $pb.ClientContext? ctx, CreatePlaylistRequest request) =>
      _client.invoke<CreatePlaylistResponse>(ctx, 'UserLibraryService',
          'CreatePlaylist', request, CreatePlaylistResponse());

  /// Signed-in user; NOT_FOUND for another user's playlist; numbers are replaced only when replace_numbers is true.
  $async.Future<UpdatePlaylistResponse> updatePlaylist(
          $pb.ClientContext? ctx, UpdatePlaylistRequest request) =>
      _client.invoke<UpdatePlaylistResponse>(ctx, 'UserLibraryService',
          'UpdatePlaylist', request, UpdatePlaylistResponse());

  /// Signed-in user; NOT_FOUND for another user's playlist.
  $async.Future<DeletePlaylistResponse> deletePlaylist(
          $pb.ClientContext? ctx, DeletePlaylistRequest request) =>
      _client.invoke<DeletePlaylistResponse>(ctx, 'UserLibraryService',
          'DeletePlaylist', request, DeletePlaylistResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
