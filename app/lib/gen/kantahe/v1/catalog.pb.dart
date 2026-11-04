// This is a generated file - do not edit.
//
// Generated from kantahe/v1/catalog.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'catalog.pbenum.dart';
import 'common.pb.dart' as $0;

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

export 'catalog.pbenum.dart';

/// Page size defaults to 50; format, letter, has_vocals and lyric_timing are optional filters.
class SearchSongsRequest extends $pb.GeneratedMessage {
  factory SearchSongsRequest({
    $core.String? query,
    $0.Format? format,
    SongSort? sort,
    $core.String? letter,
    $core.String? pageToken,
    $core.int? pageSize,
    $core.bool? hasVocals,
    $0.LyricTiming? lyricTiming,
    $core.bool? descending,
  }) {
    final result = SearchSongsRequest._();
    if (query != null) result.query = query;
    if (format != null) result.format = format;
    if (sort != null) result.sort = sort;
    if (letter != null) result.letter = letter;
    if (pageToken != null) result.pageToken = pageToken;
    if (pageSize != null) result.pageSize = pageSize;
    if (hasVocals != null) result.hasVocals = hasVocals;
    if (lyricTiming != null) result.lyricTiming = lyricTiming;
    if (descending != null) result.descending = descending;
    return result;
  }

  SearchSongsRequest._();

  factory SearchSongsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SearchSongsRequest()..mergeFromBuffer(data, registry);
  factory SearchSongsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SearchSongsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SearchSongsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SearchSongsRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'query')
    ..aE<$0.Format>(2, _omitFieldNames ? '' : 'format',
        enumValues: $0.Format.values)
    ..aE<SongSort>(3, _omitFieldNames ? '' : 'sort',
        enumValues: SongSort.values)
    ..aOS(4, _omitFieldNames ? '' : 'letter')
    ..aOS(5, _omitFieldNames ? '' : 'pageToken')
    ..aI(6, _omitFieldNames ? '' : 'pageSize')
    ..aOB(7, _omitFieldNames ? '' : 'hasVocals')
    ..aE<$0.LyricTiming>(8, _omitFieldNames ? '' : 'lyricTiming',
        enumValues: $0.LyricTiming.values)
    ..aOB(9, _omitFieldNames ? '' : 'descending')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SearchSongsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SearchSongsRequest copyWith(void Function(SearchSongsRequest) updates) =>
      super.copyWith((message) => updates(message as SearchSongsRequest))
          as SearchSongsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use SearchSongsRequest() / SearchSongsRequest.new instead')
  static SearchSongsRequest create() => SearchSongsRequest._();
  static $pb.GeneratedMessage $_createMessage() => SearchSongsRequest._();
  @$core.override
  SearchSongsRequest createEmptyInstance() => SearchSongsRequest._();
  @$core.pragma('dart2js:noInline')
  static SearchSongsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<SearchSongsRequest>(
          SearchSongsRequest.$_createMessage);
  static SearchSongsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get query => $_getSZ(0);
  @$pb.TagNumber(1)
  set query($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasQuery() => $_has(0);
  @$pb.TagNumber(1)
  void clearQuery() => $_clearField(1);

  @$pb.TagNumber(2)
  $0.Format get format => $_getN(1);
  @$pb.TagNumber(2)
  set format($0.Format value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasFormat() => $_has(1);
  @$pb.TagNumber(2)
  void clearFormat() => $_clearField(2);

  @$pb.TagNumber(3)
  SongSort get sort => $_getN(2);
  @$pb.TagNumber(3)
  set sort(SongSort value) => $_setField(3, value);
  @$pb.TagNumber(3)
  $core.bool hasSort() => $_has(2);
  @$pb.TagNumber(3)
  void clearSort() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get letter => $_getSZ(3);
  @$pb.TagNumber(4)
  set letter($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasLetter() => $_has(3);
  @$pb.TagNumber(4)
  void clearLetter() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.String get pageToken => $_getSZ(4);
  @$pb.TagNumber(5)
  set pageToken($core.String value) => $_setString(4, value);
  @$pb.TagNumber(5)
  $core.bool hasPageToken() => $_has(4);
  @$pb.TagNumber(5)
  void clearPageToken() => $_clearField(5);

  @$pb.TagNumber(6)
  $core.int get pageSize => $_getIZ(5);
  @$pb.TagNumber(6)
  set pageSize($core.int value) => $_setSignedInt32(5, value);
  @$pb.TagNumber(6)
  $core.bool hasPageSize() => $_has(5);
  @$pb.TagNumber(6)
  void clearPageSize() => $_clearField(6);

  /// Absent: any song. True: only songs with a vocals track. False: only songs without one.
  @$pb.TagNumber(7)
  $core.bool get hasVocals => $_getBF(6);
  @$pb.TagNumber(7)
  set hasVocals($core.bool value) => $_setBool(6, value);
  @$pb.TagNumber(7)
  $core.bool hasHasVocals() => $_has(6);
  @$pb.TagNumber(7)
  void clearHasVocals() => $_clearField(7);

  /// Unspecified: any song. Else only songs whose lyrics are timed by line or by word.
  @$pb.TagNumber(8)
  $0.LyricTiming get lyricTiming => $_getN(7);
  @$pb.TagNumber(8)
  set lyricTiming($0.LyricTiming value) => $_setField(8, value);
  @$pb.TagNumber(8)
  $core.bool hasLyricTiming() => $_has(7);
  @$pb.TagNumber(8)
  void clearLyricTiming() => $_clearField(8);

  /// Reverses the main sort key; the number stays the tie-breaker, in ascending order. Ignored when the order is by relevance.
  @$pb.TagNumber(9)
  $core.bool get descending => $_getBF(8);
  @$pb.TagNumber(9)
  set descending($core.bool value) => $_setBool(8, value);
  @$pb.TagNumber(9)
  $core.bool hasDescending() => $_has(8);
  @$pb.TagNumber(9)
  void clearDescending() => $_clearField(9);
}

/// One page; next_page_token is empty on the last page.
class SearchSongsResponse extends $pb.GeneratedMessage {
  factory SearchSongsResponse({
    $core.Iterable<$0.Song>? songs,
    $core.String? nextPageToken,
  }) {
    final result = SearchSongsResponse._();
    if (songs != null) result.songs.addAll(songs);
    if (nextPageToken != null) result.nextPageToken = nextPageToken;
    return result;
  }

  SearchSongsResponse._();

  factory SearchSongsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SearchSongsResponse()..mergeFromBuffer(data, registry);
  factory SearchSongsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      SearchSongsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'SearchSongsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: SearchSongsResponse.$_createMessage)
    ..pPM<$0.Song>(1, _omitFieldNames ? '' : 'songs',
        subBuilder: $0.Song.$_createMessage)
    ..aOS(2, _omitFieldNames ? '' : 'nextPageToken')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SearchSongsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  SearchSongsResponse copyWith(void Function(SearchSongsResponse) updates) =>
      super.copyWith((message) => updates(message as SearchSongsResponse))
          as SearchSongsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use SearchSongsResponse() / SearchSongsResponse.new instead')
  static SearchSongsResponse create() => SearchSongsResponse._();
  static $pb.GeneratedMessage $_createMessage() => SearchSongsResponse._();
  @$core.override
  SearchSongsResponse createEmptyInstance() => SearchSongsResponse._();
  @$core.pragma('dart2js:noInline')
  static SearchSongsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<SearchSongsResponse>(
          SearchSongsResponse.$_createMessage);
  static SearchSongsResponse? _defaultInstance;

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

/// An artist name and how many songs carry it.
class Artist extends $pb.GeneratedMessage {
  factory Artist({
    $core.String? name,
    $core.int? songCount,
  }) {
    final result = Artist._();
    if (name != null) result.name = name;
    if (songCount != null) result.songCount = songCount;
    return result;
  }

  Artist._();

  factory Artist.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Artist()..mergeFromBuffer(data, registry);
  factory Artist.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Artist()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Artist',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Artist.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'name')
    ..aI(2, _omitFieldNames ? '' : 'songCount')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Artist clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Artist copyWith(void Function(Artist) updates) =>
      super.copyWith((message) => updates(message as Artist)) as Artist;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Artist() / Artist.new instead')
  static Artist create() => Artist._();
  static $pb.GeneratedMessage $_createMessage() => Artist._();
  @$core.override
  Artist createEmptyInstance() => Artist._();
  @$core.pragma('dart2js:noInline')
  static Artist getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Artist>(Artist.$_createMessage);
  static Artist? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get name => $_getSZ(0);
  @$pb.TagNumber(1)
  set name($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasName() => $_has(0);
  @$pb.TagNumber(1)
  void clearName() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.int get songCount => $_getIZ(1);
  @$pb.TagNumber(2)
  set songCount($core.int value) => $_setSignedInt32(1, value);
  @$pb.TagNumber(2)
  $core.bool hasSongCount() => $_has(1);
  @$pb.TagNumber(2)
  void clearSongCount() => $_clearField(2);
}

/// Optional first-letter filter and paging.
class ListArtistsRequest extends $pb.GeneratedMessage {
  factory ListArtistsRequest({
    $core.String? letter,
    $core.String? pageToken,
    $core.int? pageSize,
  }) {
    final result = ListArtistsRequest._();
    if (letter != null) result.letter = letter;
    if (pageToken != null) result.pageToken = pageToken;
    if (pageSize != null) result.pageSize = pageSize;
    return result;
  }

  ListArtistsRequest._();

  factory ListArtistsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListArtistsRequest()..mergeFromBuffer(data, registry);
  factory ListArtistsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListArtistsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListArtistsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListArtistsRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'letter')
    ..aOS(2, _omitFieldNames ? '' : 'pageToken')
    ..aI(3, _omitFieldNames ? '' : 'pageSize')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListArtistsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListArtistsRequest copyWith(void Function(ListArtistsRequest) updates) =>
      super.copyWith((message) => updates(message as ListArtistsRequest))
          as ListArtistsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use ListArtistsRequest() / ListArtistsRequest.new instead')
  static ListArtistsRequest create() => ListArtistsRequest._();
  static $pb.GeneratedMessage $_createMessage() => ListArtistsRequest._();
  @$core.override
  ListArtistsRequest createEmptyInstance() => ListArtistsRequest._();
  @$core.pragma('dart2js:noInline')
  static ListArtistsRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListArtistsRequest>(
          ListArtistsRequest.$_createMessage);
  static ListArtistsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get letter => $_getSZ(0);
  @$pb.TagNumber(1)
  set letter($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasLetter() => $_has(0);
  @$pb.TagNumber(1)
  void clearLetter() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get pageToken => $_getSZ(1);
  @$pb.TagNumber(2)
  set pageToken($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasPageToken() => $_has(1);
  @$pb.TagNumber(2)
  void clearPageToken() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.int get pageSize => $_getIZ(2);
  @$pb.TagNumber(3)
  set pageSize($core.int value) => $_setSignedInt32(2, value);
  @$pb.TagNumber(3)
  $core.bool hasPageSize() => $_has(2);
  @$pb.TagNumber(3)
  void clearPageSize() => $_clearField(3);
}

/// One page of artists.
class ListArtistsResponse extends $pb.GeneratedMessage {
  factory ListArtistsResponse({
    $core.Iterable<Artist>? artists,
    $core.String? nextPageToken,
  }) {
    final result = ListArtistsResponse._();
    if (artists != null) result.artists.addAll(artists);
    if (nextPageToken != null) result.nextPageToken = nextPageToken;
    return result;
  }

  ListArtistsResponse._();

  factory ListArtistsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListArtistsResponse()..mergeFromBuffer(data, registry);
  factory ListArtistsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      ListArtistsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'ListArtistsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: ListArtistsResponse.$_createMessage)
    ..pPM<Artist>(1, _omitFieldNames ? '' : 'artists',
        subBuilder: Artist.$_createMessage)
    ..aOS(2, _omitFieldNames ? '' : 'nextPageToken')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListArtistsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  ListArtistsResponse copyWith(void Function(ListArtistsResponse) updates) =>
      super.copyWith((message) => updates(message as ListArtistsResponse))
          as ListArtistsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use ListArtistsResponse() / ListArtistsResponse.new instead')
  static ListArtistsResponse create() => ListArtistsResponse._();
  static $pb.GeneratedMessage $_createMessage() => ListArtistsResponse._();
  @$core.override
  ListArtistsResponse createEmptyInstance() => ListArtistsResponse._();
  @$core.pragma('dart2js:noInline')
  static ListArtistsResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<ListArtistsResponse>(
          ListArtistsResponse.$_createMessage);
  static ListArtistsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $pb.PbList<Artist> get artists => $_getList(0);

  @$pb.TagNumber(2)
  $core.String get nextPageToken => $_getSZ(1);
  @$pb.TagNumber(2)
  set nextPageToken($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasNextPageToken() => $_has(1);
  @$pb.TagNumber(2)
  void clearNextPageToken() => $_clearField(2);
}

/// The number to look up.
class GetSongRequest extends $pb.GeneratedMessage {
  factory GetSongRequest({
    $core.String? number,
  }) {
    final result = GetSongRequest._();
    if (number != null) result.number = number;
    return result;
  }

  GetSongRequest._();

  factory GetSongRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongRequest()..mergeFromBuffer(data, registry);
  factory GetSongRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetSongRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetSongRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongRequest copyWith(void Function(GetSongRequest) updates) =>
      super.copyWith((message) => updates(message as GetSongRequest))
          as GetSongRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetSongRequest() / GetSongRequest.new instead')
  static GetSongRequest create() => GetSongRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetSongRequest._();
  @$core.override
  GetSongRequest createEmptyInstance() => GetSongRequest._();
  @$core.pragma('dart2js:noInline')
  static GetSongRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<GetSongRequest>(
          GetSongRequest.$_createMessage);
  static GetSongRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);
}

/// The song.
class GetSongResponse extends $pb.GeneratedMessage {
  factory GetSongResponse({
    $0.Song? song,
  }) {
    final result = GetSongResponse._();
    if (song != null) result.song = song;
    return result;
  }

  GetSongResponse._();

  factory GetSongResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongResponse()..mergeFromBuffer(data, registry);
  factory GetSongResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetSongResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetSongResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetSongResponse.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetSongResponse copyWith(void Function(GetSongResponse) updates) =>
      super.copyWith((message) => updates(message as GetSongResponse))
          as GetSongResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetSongResponse() / GetSongResponse.new instead')
  static GetSongResponse create() => GetSongResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetSongResponse._();
  @$core.override
  GetSongResponse createEmptyInstance() => GetSongResponse._();
  @$core.pragma('dart2js:noInline')
  static GetSongResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<GetSongResponse>(
          GetSongResponse.$_createMessage);
  static GetSongResponse? _defaultInstance;

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

/// The number whose lyrics are wanted.
class GetLyricsRequest extends $pb.GeneratedMessage {
  factory GetLyricsRequest({
    $core.String? number,
  }) {
    final result = GetLyricsRequest._();
    if (number != null) result.number = number;
    return result;
  }

  GetLyricsRequest._();

  factory GetLyricsRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetLyricsRequest()..mergeFromBuffer(data, registry);
  factory GetLyricsRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetLyricsRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetLyricsRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetLyricsRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetLyricsRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetLyricsRequest copyWith(void Function(GetLyricsRequest) updates) =>
      super.copyWith((message) => updates(message as GetLyricsRequest))
          as GetLyricsRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetLyricsRequest() / GetLyricsRequest.new instead')
  static GetLyricsRequest create() => GetLyricsRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetLyricsRequest._();
  @$core.override
  GetLyricsRequest createEmptyInstance() => GetLyricsRequest._();
  @$core.pragma('dart2js:noInline')
  static GetLyricsRequest getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<GetLyricsRequest>(
          GetLyricsRequest.$_createMessage);
  static GetLyricsRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);
}

/// The lyrics.
class GetLyricsResponse extends $pb.GeneratedMessage {
  factory GetLyricsResponse({
    $0.Lyrics? lyrics,
  }) {
    final result = GetLyricsResponse._();
    if (lyrics != null) result.lyrics = lyrics;
    return result;
  }

  GetLyricsResponse._();

  factory GetLyricsResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetLyricsResponse()..mergeFromBuffer(data, registry);
  factory GetLyricsResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetLyricsResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetLyricsResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetLyricsResponse.$_createMessage)
    ..aOM<$0.Lyrics>(1, _omitFieldNames ? '' : 'lyrics',
        subBuilder: $0.Lyrics.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetLyricsResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetLyricsResponse copyWith(void Function(GetLyricsResponse) updates) =>
      super.copyWith((message) => updates(message as GetLyricsResponse))
          as GetLyricsResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetLyricsResponse() / GetLyricsResponse.new instead')
  static GetLyricsResponse create() => GetLyricsResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetLyricsResponse._();
  @$core.override
  GetLyricsResponse createEmptyInstance() => GetLyricsResponse._();
  @$core.pragma('dart2js:noInline')
  static GetLyricsResponse getDefault() =>
      _defaultInstance ??= $pb.GeneratedMessage.$_defaultFor<GetLyricsResponse>(
          GetLyricsResponse.$_createMessage);
  static GetLyricsResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $0.Lyrics get lyrics => $_getN(0);
  @$pb.TagNumber(1)
  set lyrics($0.Lyrics value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasLyrics() => $_has(0);
  @$pb.TagNumber(1)
  void clearLyrics() => $_clearField(1);
  @$pb.TagNumber(1)
  $0.Lyrics ensureLyrics() => $_ensure(0);
}

/// The number to play; the calling device decides the MIDI mode.
class GetPlaybackRequest extends $pb.GeneratedMessage {
  factory GetPlaybackRequest({
    $core.String? number,
  }) {
    final result = GetPlaybackRequest._();
    if (number != null) result.number = number;
    return result;
  }

  GetPlaybackRequest._();

  factory GetPlaybackRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaybackRequest()..mergeFromBuffer(data, registry);
  factory GetPlaybackRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaybackRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetPlaybackRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetPlaybackRequest.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaybackRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaybackRequest copyWith(void Function(GetPlaybackRequest) updates) =>
      super.copyWith((message) => updates(message as GetPlaybackRequest))
          as GetPlaybackRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use GetPlaybackRequest() / GetPlaybackRequest.new instead')
  static GetPlaybackRequest create() => GetPlaybackRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetPlaybackRequest._();
  @$core.override
  GetPlaybackRequest createEmptyInstance() => GetPlaybackRequest._();
  @$core.pragma('dart2js:noInline')
  static GetPlaybackRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetPlaybackRequest>(
          GetPlaybackRequest.$_createMessage);
  static GetPlaybackRequest? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);
}

/// Everything a player needs for one song.
class Playback extends $pb.GeneratedMessage {
  factory Playback({
    $0.Song? song,
    PlaybackKind? kind,
    $core.String? audioUrl,
    $core.String? midiUrl,
    $core.String? soundfontUrl,
    $0.MidiMode? effectiveMidiMode,
    $core.bool? ready,
    $core.int? retryAfterMs,
    $0.Lyrics? lyrics,
    $core.double? gainDb,
    $core.String? vocalsUrl,
    $core.String? audioVersion,
    $core.String? vocalsVersion,
  }) {
    final result = Playback._();
    if (song != null) result.song = song;
    if (kind != null) result.kind = kind;
    if (audioUrl != null) result.audioUrl = audioUrl;
    if (midiUrl != null) result.midiUrl = midiUrl;
    if (soundfontUrl != null) result.soundfontUrl = soundfontUrl;
    if (effectiveMidiMode != null) result.effectiveMidiMode = effectiveMidiMode;
    if (ready != null) result.ready = ready;
    if (retryAfterMs != null) result.retryAfterMs = retryAfterMs;
    if (lyrics != null) result.lyrics = lyrics;
    if (gainDb != null) result.gainDb = gainDb;
    if (vocalsUrl != null) result.vocalsUrl = vocalsUrl;
    if (audioVersion != null) result.audioVersion = audioVersion;
    if (vocalsVersion != null) result.vocalsVersion = vocalsVersion;
    return result;
  }

  Playback._();

  factory Playback.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Playback()..mergeFromBuffer(data, registry);
  factory Playback.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Playback()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Playback',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Playback.$_createMessage)
    ..aOM<$0.Song>(1, _omitFieldNames ? '' : 'song',
        subBuilder: $0.Song.$_createMessage)
    ..aE<PlaybackKind>(2, _omitFieldNames ? '' : 'kind',
        enumValues: PlaybackKind.values)
    ..aOS(3, _omitFieldNames ? '' : 'audioUrl')
    ..aOS(4, _omitFieldNames ? '' : 'midiUrl')
    ..aOS(5, _omitFieldNames ? '' : 'soundfontUrl')
    ..aE<$0.MidiMode>(6, _omitFieldNames ? '' : 'effectiveMidiMode',
        enumValues: $0.MidiMode.values)
    ..aOB(7, _omitFieldNames ? '' : 'ready')
    ..aI(8, _omitFieldNames ? '' : 'retryAfterMs')
    ..aOM<$0.Lyrics>(9, _omitFieldNames ? '' : 'lyrics',
        subBuilder: $0.Lyrics.$_createMessage)
    ..aD(10, _omitFieldNames ? '' : 'gainDb', fieldType: $pb.PbFieldType.OF)
    ..aOS(11, _omitFieldNames ? '' : 'vocalsUrl')
    ..aOS(12, _omitFieldNames ? '' : 'audioVersion')
    ..aOS(13, _omitFieldNames ? '' : 'vocalsVersion')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Playback clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Playback copyWith(void Function(Playback) updates) =>
      super.copyWith((message) => updates(message as Playback)) as Playback;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Playback() / Playback.new instead')
  static Playback create() => Playback._();
  static $pb.GeneratedMessage $_createMessage() => Playback._();
  @$core.override
  Playback createEmptyInstance() => Playback._();
  @$core.pragma('dart2js:noInline')
  static Playback getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Playback>(Playback.$_createMessage);
  static Playback? _defaultInstance;

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
  PlaybackKind get kind => $_getN(1);
  @$pb.TagNumber(2)
  set kind(PlaybackKind value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasKind() => $_has(1);
  @$pb.TagNumber(2)
  void clearKind() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get audioUrl => $_getSZ(2);
  @$pb.TagNumber(3)
  set audioUrl($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasAudioUrl() => $_has(2);
  @$pb.TagNumber(3)
  void clearAudioUrl() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get midiUrl => $_getSZ(3);
  @$pb.TagNumber(4)
  set midiUrl($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasMidiUrl() => $_has(3);
  @$pb.TagNumber(4)
  void clearMidiUrl() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.String get soundfontUrl => $_getSZ(4);
  @$pb.TagNumber(5)
  set soundfontUrl($core.String value) => $_setString(4, value);
  @$pb.TagNumber(5)
  $core.bool hasSoundfontUrl() => $_has(4);
  @$pb.TagNumber(5)
  void clearSoundfontUrl() => $_clearField(5);

  @$pb.TagNumber(6)
  $0.MidiMode get effectiveMidiMode => $_getN(5);
  @$pb.TagNumber(6)
  set effectiveMidiMode($0.MidiMode value) => $_setField(6, value);
  @$pb.TagNumber(6)
  $core.bool hasEffectiveMidiMode() => $_has(5);
  @$pb.TagNumber(6)
  void clearEffectiveMidiMode() => $_clearField(6);

  @$pb.TagNumber(7)
  $core.bool get ready => $_getBF(6);
  @$pb.TagNumber(7)
  set ready($core.bool value) => $_setBool(6, value);
  @$pb.TagNumber(7)
  $core.bool hasReady() => $_has(6);
  @$pb.TagNumber(7)
  void clearReady() => $_clearField(7);

  @$pb.TagNumber(8)
  $core.int get retryAfterMs => $_getIZ(7);
  @$pb.TagNumber(8)
  set retryAfterMs($core.int value) => $_setSignedInt32(7, value);
  @$pb.TagNumber(8)
  $core.bool hasRetryAfterMs() => $_has(7);
  @$pb.TagNumber(8)
  void clearRetryAfterMs() => $_clearField(8);

  @$pb.TagNumber(9)
  $0.Lyrics get lyrics => $_getN(8);
  @$pb.TagNumber(9)
  set lyrics($0.Lyrics value) => $_setField(9, value);
  @$pb.TagNumber(9)
  $core.bool hasLyrics() => $_has(8);
  @$pb.TagNumber(9)
  void clearLyrics() => $_clearField(9);
  @$pb.TagNumber(9)
  $0.Lyrics ensureLyrics() => $_ensure(8);

  /// The gain in dB that brings this song to the common loudness (an MP3 song, once the server has measured it); the player adds it to the device's
  /// own volume. Absent: no gain is known and the song plays as it is.
  @$pb.TagNumber(10)
  $core.double get gainDb => $_getN(9);
  @$pb.TagNumber(10)
  set gainDb($core.double value) => $_setFloat(9, value);
  @$pb.TagNumber(10)
  $core.bool hasGainDb() => $_has(9);
  @$pb.TagNumber(10)
  void clearGainDb() => $_clearField(10);

  /// The signed URL of the song's vocals track (the singer's voice alone, same start and length as audio_url, so the two play in step);
  /// it has the same signing and lifetime as audio_url. Empty when the song has none.
  @$pb.TagNumber(11)
  $core.String get vocalsUrl => $_getSZ(10);
  @$pb.TagNumber(11)
  set vocalsUrl($core.String value) => $_setString(10, value);
  @$pb.TagNumber(11)
  $core.bool hasVocalsUrl() => $_has(10);
  @$pb.TagNumber(11)
  void clearVocalsUrl() => $_clearField(11);

  /// A value that changes whenever the file behind audio_url changes (a replaced song file, a render made again). Empty: unknown, a player must not
  /// keep a copy of the file. Players compare it for equality only and never read a meaning into it.
  @$pb.TagNumber(12)
  $core.String get audioVersion => $_getSZ(11);
  @$pb.TagNumber(12)
  set audioVersion($core.String value) => $_setString(11, value);
  @$pb.TagNumber(12)
  $core.bool hasAudioVersion() => $_has(11);
  @$pb.TagNumber(12)
  void clearAudioVersion() => $_clearField(12);

  /// The same for the file behind vocals_url; empty when there is no vocals track.
  @$pb.TagNumber(13)
  $core.String get vocalsVersion => $_getSZ(12);
  @$pb.TagNumber(13)
  set vocalsVersion($core.String value) => $_setString(12, value);
  @$pb.TagNumber(13)
  $core.bool hasVocalsVersion() => $_has(12);
  @$pb.TagNumber(13)
  void clearVocalsVersion() => $_clearField(13);
}

/// The playback description.
class GetPlaybackResponse extends $pb.GeneratedMessage {
  factory GetPlaybackResponse({
    Playback? playback,
  }) {
    final result = GetPlaybackResponse._();
    if (playback != null) result.playback = playback;
    return result;
  }

  GetPlaybackResponse._();

  factory GetPlaybackResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaybackResponse()..mergeFromBuffer(data, registry);
  factory GetPlaybackResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetPlaybackResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetPlaybackResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetPlaybackResponse.$_createMessage)
    ..aOM<Playback>(1, _omitFieldNames ? '' : 'playback',
        subBuilder: Playback.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaybackResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetPlaybackResponse copyWith(void Function(GetPlaybackResponse) updates) =>
      super.copyWith((message) => updates(message as GetPlaybackResponse))
          as GetPlaybackResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core
      .Deprecated('Use GetPlaybackResponse() / GetPlaybackResponse.new instead')
  static GetPlaybackResponse create() => GetPlaybackResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetPlaybackResponse._();
  @$core.override
  GetPlaybackResponse createEmptyInstance() => GetPlaybackResponse._();
  @$core.pragma('dart2js:noInline')
  static GetPlaybackResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetPlaybackResponse>(
          GetPlaybackResponse.$_createMessage);
  static GetPlaybackResponse? _defaultInstance;

  @$pb.TagNumber(1)
  Playback get playback => $_getN(0);
  @$pb.TagNumber(1)
  set playback(Playback value) => $_setField(1, value);
  @$pb.TagNumber(1)
  $core.bool hasPlayback() => $_has(0);
  @$pb.TagNumber(1)
  void clearPlayback() => $_clearField(1);
  @$pb.TagNumber(1)
  Playback ensurePlayback() => $_ensure(0);
}

/// Asks nothing.
class GetBackgroundRequest extends $pb.GeneratedMessage {
  factory GetBackgroundRequest() => GetBackgroundRequest._();

  GetBackgroundRequest._();

  factory GetBackgroundRequest.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetBackgroundRequest()..mergeFromBuffer(data, registry);
  factory GetBackgroundRequest.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetBackgroundRequest()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetBackgroundRequest',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetBackgroundRequest.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetBackgroundRequest clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetBackgroundRequest copyWith(void Function(GetBackgroundRequest) updates) =>
      super.copyWith((message) => updates(message as GetBackgroundRequest))
          as GetBackgroundRequest;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetBackgroundRequest() / GetBackgroundRequest.new instead')
  static GetBackgroundRequest create() => GetBackgroundRequest._();
  static $pb.GeneratedMessage $_createMessage() => GetBackgroundRequest._();
  @$core.override
  GetBackgroundRequest createEmptyInstance() => GetBackgroundRequest._();
  @$core.pragma('dart2js:noInline')
  static GetBackgroundRequest getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetBackgroundRequest>(
          GetBackgroundRequest.$_createMessage);
  static GetBackgroundRequest? _defaultInstance;
}

/// enabled is the admin's switch; when it is false videos is empty. shuffle asks the player to shuffle the order on every pass.
class GetBackgroundResponse extends $pb.GeneratedMessage {
  factory GetBackgroundResponse({
    $core.bool? enabled,
    $core.bool? shuffle,
    $core.Iterable<$0.Video>? videos,
  }) {
    final result = GetBackgroundResponse._();
    if (enabled != null) result.enabled = enabled;
    if (shuffle != null) result.shuffle = shuffle;
    if (videos != null) result.videos.addAll(videos);
    return result;
  }

  GetBackgroundResponse._();

  factory GetBackgroundResponse.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetBackgroundResponse()..mergeFromBuffer(data, registry);
  factory GetBackgroundResponse.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      GetBackgroundResponse()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'GetBackgroundResponse',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: GetBackgroundResponse.$_createMessage)
    ..aOB(1, _omitFieldNames ? '' : 'enabled')
    ..aOB(2, _omitFieldNames ? '' : 'shuffle')
    ..pPM<$0.Video>(3, _omitFieldNames ? '' : 'videos',
        subBuilder: $0.Video.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetBackgroundResponse clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  GetBackgroundResponse copyWith(
          void Function(GetBackgroundResponse) updates) =>
      super.copyWith((message) => updates(message as GetBackgroundResponse))
          as GetBackgroundResponse;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated(
      'Use GetBackgroundResponse() / GetBackgroundResponse.new instead')
  static GetBackgroundResponse create() => GetBackgroundResponse._();
  static $pb.GeneratedMessage $_createMessage() => GetBackgroundResponse._();
  @$core.override
  GetBackgroundResponse createEmptyInstance() => GetBackgroundResponse._();
  @$core.pragma('dart2js:noInline')
  static GetBackgroundResponse getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<GetBackgroundResponse>(
          GetBackgroundResponse.$_createMessage);
  static GetBackgroundResponse? _defaultInstance;

  @$pb.TagNumber(1)
  $core.bool get enabled => $_getBF(0);
  @$pb.TagNumber(1)
  set enabled($core.bool value) => $_setBool(0, value);
  @$pb.TagNumber(1)
  $core.bool hasEnabled() => $_has(0);
  @$pb.TagNumber(1)
  void clearEnabled() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.bool get shuffle => $_getBF(1);
  @$pb.TagNumber(2)
  set shuffle($core.bool value) => $_setBool(1, value);
  @$pb.TagNumber(2)
  $core.bool hasShuffle() => $_has(1);
  @$pb.TagNumber(2)
  void clearShuffle() => $_clearField(2);

  @$pb.TagNumber(3)
  $pb.PbList<$0.Video> get videos => $_getList(2);
}

/// Read-only library access; any signed-in user (UNAUTHENTICATED otherwise).
class CatalogServiceApi {
  final $pb.RpcClient _client;

  CatalogServiceApi(this._client);

  /// Signed-in user. Digits-only query matches the number prefix, otherwise full-text over title and artist (plan 6).
  $async.Future<SearchSongsResponse> searchSongs(
          $pb.ClientContext? ctx, SearchSongsRequest request) =>
      _client.invoke<SearchSongsResponse>(
          ctx, 'CatalogService', 'SearchSongs', request, SearchSongsResponse());

  /// Signed-in user. Artists with their song counts, optionally restricted to a first letter ("#" for non-letters).
  $async.Future<ListArtistsResponse> listArtists(
          $pb.ClientContext? ctx, ListArtistsRequest request) =>
      _client.invoke<ListArtistsResponse>(
          ctx, 'CatalogService', 'ListArtists', request, ListArtistsResponse());

  /// Signed-in user. Number pad lookup; NOT_FOUND for an unknown number.
  $async.Future<GetSongResponse> getSong(
          $pb.ClientContext? ctx, GetSongRequest request) =>
      _client.invoke<GetSongResponse>(
          ctx, 'CatalogService', 'GetSong', request, GetSongResponse());

  /// Signed-in user. Parsed lyrics for a song; NOT_FOUND for an unknown number or a song without lyrics.
  $async.Future<GetLyricsResponse> getLyrics(
          $pb.ClientContext? ctx, GetLyricsRequest request) =>
      _client.invoke<GetLyricsResponse>(
          ctx, 'CatalogService', 'GetLyrics', request, GetLyricsResponse());

  /// Signed-in user. Signed URLs, lyrics and the MIDI mode resolved for the calling device (plan 4.1); ready=false means retry later.
  $async.Future<GetPlaybackResponse> getPlayback(
          $pb.ClientContext? ctx, GetPlaybackRequest request) =>
      _client.invoke<GetPlaybackResponse>(
          ctx, 'CatalogService', 'GetPlayback', request, GetPlaybackResponse());

  /// Signed-in user. The enabled background videos in loop order with signed URLs (6 hours); empty when the admin has switched the background off.
  $async.Future<GetBackgroundResponse> getBackground(
          $pb.ClientContext? ctx, GetBackgroundRequest request) =>
      _client.invoke<GetBackgroundResponse>(ctx, 'CatalogService',
          'GetBackground', request, GetBackgroundResponse());
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
