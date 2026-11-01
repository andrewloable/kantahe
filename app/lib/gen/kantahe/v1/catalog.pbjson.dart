// This is a generated file - do not edit.
//
// Generated from kantahe/v1/catalog.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports
// ignore_for_file: unused_import

import 'dart:convert' as $convert;
import 'dart:core' as $core;
import 'dart:typed_data' as $typed_data;

import 'common.pbjson.dart' as $0;

@$core.Deprecated('Use songSortDescriptor instead')
const SongSort$json = {
  '1': 'SongSort',
  '2': [
    {'1': 'SONG_SORT_UNSPECIFIED', '2': 0},
    {'1': 'SONG_SORT_NUMBER', '2': 1},
    {'1': 'SONG_SORT_TITLE', '2': 2},
    {'1': 'SONG_SORT_ARTIST', '2': 3},
  ],
};

/// Descriptor for `SongSort`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List songSortDescriptor = $convert.base64Decode(
    'CghTb25nU29ydBIZChVTT05HX1NPUlRfVU5TUEVDSUZJRUQQABIUChBTT05HX1NPUlRfTlVNQk'
    'VSEAESEwoPU09OR19TT1JUX1RJVExFEAISFAoQU09OR19TT1JUX0FSVElTVBAD');

@$core.Deprecated('Use playbackKindDescriptor instead')
const PlaybackKind$json = {
  '1': 'PlaybackKind',
  '2': [
    {'1': 'PLAYBACK_KIND_UNSPECIFIED', '2': 0},
    {'1': 'PLAYBACK_KIND_AUDIO', '2': 1},
    {'1': 'PLAYBACK_KIND_MIDI_SYNTH', '2': 2},
  ],
};

/// Descriptor for `PlaybackKind`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List playbackKindDescriptor = $convert.base64Decode(
    'CgxQbGF5YmFja0tpbmQSHQoZUExBWUJBQ0tfS0lORF9VTlNQRUNJRklFRBAAEhcKE1BMQVlCQU'
    'NLX0tJTkRfQVVESU8QARIcChhQTEFZQkFDS19LSU5EX01JRElfU1lOVEgQAg==');

@$core.Deprecated('Use searchSongsRequestDescriptor instead')
const SearchSongsRequest$json = {
  '1': 'SearchSongsRequest',
  '2': [
    {'1': 'query', '3': 1, '4': 1, '5': 9, '10': 'query'},
    {
      '1': 'format',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.Format',
      '10': 'format'
    },
    {
      '1': 'sort',
      '3': 3,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.SongSort',
      '10': 'sort'
    },
    {'1': 'letter', '3': 4, '4': 1, '5': 9, '10': 'letter'},
    {'1': 'page_token', '3': 5, '4': 1, '5': 9, '10': 'pageToken'},
    {'1': 'page_size', '3': 6, '4': 1, '5': 5, '10': 'pageSize'},
  ],
};

/// Descriptor for `SearchSongsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List searchSongsRequestDescriptor = $convert.base64Decode(
    'ChJTZWFyY2hTb25nc1JlcXVlc3QSFAoFcXVlcnkYASABKAlSBXF1ZXJ5EioKBmZvcm1hdBgCIA'
    'EoDjISLmthbnRhaGUudjEuRm9ybWF0UgZmb3JtYXQSKAoEc29ydBgDIAEoDjIULmthbnRhaGUu'
    'djEuU29uZ1NvcnRSBHNvcnQSFgoGbGV0dGVyGAQgASgJUgZsZXR0ZXISHQoKcGFnZV90b2tlbh'
    'gFIAEoCVIJcGFnZVRva2VuEhsKCXBhZ2Vfc2l6ZRgGIAEoBVIIcGFnZVNpemU=');

@$core.Deprecated('Use searchSongsResponseDescriptor instead')
const SearchSongsResponse$json = {
  '1': 'SearchSongsResponse',
  '2': [
    {
      '1': 'songs',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'songs'
    },
    {'1': 'next_page_token', '3': 2, '4': 1, '5': 9, '10': 'nextPageToken'},
  ],
};

/// Descriptor for `SearchSongsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List searchSongsResponseDescriptor = $convert.base64Decode(
    'ChNTZWFyY2hTb25nc1Jlc3BvbnNlEiYKBXNvbmdzGAEgAygLMhAua2FudGFoZS52MS5Tb25nUg'
    'Vzb25ncxImCg9uZXh0X3BhZ2VfdG9rZW4YAiABKAlSDW5leHRQYWdlVG9rZW4=');

@$core.Deprecated('Use artistDescriptor instead')
const Artist$json = {
  '1': 'Artist',
  '2': [
    {'1': 'name', '3': 1, '4': 1, '5': 9, '10': 'name'},
    {'1': 'song_count', '3': 2, '4': 1, '5': 5, '10': 'songCount'},
  ],
};

/// Descriptor for `Artist`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List artistDescriptor = $convert.base64Decode(
    'CgZBcnRpc3QSEgoEbmFtZRgBIAEoCVIEbmFtZRIdCgpzb25nX2NvdW50GAIgASgFUglzb25nQ2'
    '91bnQ=');

@$core.Deprecated('Use listArtistsRequestDescriptor instead')
const ListArtistsRequest$json = {
  '1': 'ListArtistsRequest',
  '2': [
    {'1': 'letter', '3': 1, '4': 1, '5': 9, '10': 'letter'},
    {'1': 'page_token', '3': 2, '4': 1, '5': 9, '10': 'pageToken'},
    {'1': 'page_size', '3': 3, '4': 1, '5': 5, '10': 'pageSize'},
  ],
};

/// Descriptor for `ListArtistsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listArtistsRequestDescriptor = $convert.base64Decode(
    'ChJMaXN0QXJ0aXN0c1JlcXVlc3QSFgoGbGV0dGVyGAEgASgJUgZsZXR0ZXISHQoKcGFnZV90b2'
    'tlbhgCIAEoCVIJcGFnZVRva2VuEhsKCXBhZ2Vfc2l6ZRgDIAEoBVIIcGFnZVNpemU=');

@$core.Deprecated('Use listArtistsResponseDescriptor instead')
const ListArtistsResponse$json = {
  '1': 'ListArtistsResponse',
  '2': [
    {
      '1': 'artists',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Artist',
      '10': 'artists'
    },
    {'1': 'next_page_token', '3': 2, '4': 1, '5': 9, '10': 'nextPageToken'},
  ],
};

/// Descriptor for `ListArtistsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listArtistsResponseDescriptor = $convert.base64Decode(
    'ChNMaXN0QXJ0aXN0c1Jlc3BvbnNlEiwKB2FydGlzdHMYASADKAsyEi5rYW50YWhlLnYxLkFydG'
    'lzdFIHYXJ0aXN0cxImCg9uZXh0X3BhZ2VfdG9rZW4YAiABKAlSDW5leHRQYWdlVG9rZW4=');

@$core.Deprecated('Use getSongRequestDescriptor instead')
const GetSongRequest$json = {
  '1': 'GetSongRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
  ],
};

/// Descriptor for `GetSongRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getSongRequestDescriptor = $convert
    .base64Decode('Cg5HZXRTb25nUmVxdWVzdBIWCgZudW1iZXIYASABKAlSBm51bWJlcg==');

@$core.Deprecated('Use getSongResponseDescriptor instead')
const GetSongResponse$json = {
  '1': 'GetSongResponse',
  '2': [
    {
      '1': 'song',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'song'
    },
  ],
};

/// Descriptor for `GetSongResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getSongResponseDescriptor = $convert.base64Decode(
    'Cg9HZXRTb25nUmVzcG9uc2USJAoEc29uZxgBIAEoCzIQLmthbnRhaGUudjEuU29uZ1IEc29uZw'
    '==');

@$core.Deprecated('Use getLyricsRequestDescriptor instead')
const GetLyricsRequest$json = {
  '1': 'GetLyricsRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
  ],
};

/// Descriptor for `GetLyricsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getLyricsRequestDescriptor = $convert
    .base64Decode('ChBHZXRMeXJpY3NSZXF1ZXN0EhYKBm51bWJlchgBIAEoCVIGbnVtYmVy');

@$core.Deprecated('Use getLyricsResponseDescriptor instead')
const GetLyricsResponse$json = {
  '1': 'GetLyricsResponse',
  '2': [
    {
      '1': 'lyrics',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Lyrics',
      '10': 'lyrics'
    },
  ],
};

/// Descriptor for `GetLyricsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getLyricsResponseDescriptor = $convert.base64Decode(
    'ChFHZXRMeXJpY3NSZXNwb25zZRIqCgZseXJpY3MYASABKAsyEi5rYW50YWhlLnYxLkx5cmljc1'
    'IGbHlyaWNz');

@$core.Deprecated('Use getPlaybackRequestDescriptor instead')
const GetPlaybackRequest$json = {
  '1': 'GetPlaybackRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
  ],
};

/// Descriptor for `GetPlaybackRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getPlaybackRequestDescriptor =
    $convert.base64Decode(
        'ChJHZXRQbGF5YmFja1JlcXVlc3QSFgoGbnVtYmVyGAEgASgJUgZudW1iZXI=');

@$core.Deprecated('Use playbackDescriptor instead')
const Playback$json = {
  '1': 'Playback',
  '2': [
    {
      '1': 'song',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'song'
    },
    {
      '1': 'kind',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.PlaybackKind',
      '10': 'kind'
    },
    {'1': 'audio_url', '3': 3, '4': 1, '5': 9, '10': 'audioUrl'},
    {'1': 'midi_url', '3': 4, '4': 1, '5': 9, '10': 'midiUrl'},
    {'1': 'soundfont_url', '3': 5, '4': 1, '5': 9, '10': 'soundfontUrl'},
    {
      '1': 'effective_midi_mode',
      '3': 6,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.MidiMode',
      '10': 'effectiveMidiMode'
    },
    {'1': 'ready', '3': 7, '4': 1, '5': 8, '10': 'ready'},
    {'1': 'retry_after_ms', '3': 8, '4': 1, '5': 5, '10': 'retryAfterMs'},
    {
      '1': 'lyrics',
      '3': 9,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Lyrics',
      '10': 'lyrics'
    },
  ],
};

/// Descriptor for `Playback`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List playbackDescriptor = $convert.base64Decode(
    'CghQbGF5YmFjaxIkCgRzb25nGAEgASgLMhAua2FudGFoZS52MS5Tb25nUgRzb25nEiwKBGtpbm'
    'QYAiABKA4yGC5rYW50YWhlLnYxLlBsYXliYWNrS2luZFIEa2luZBIbCglhdWRpb191cmwYAyAB'
    'KAlSCGF1ZGlvVXJsEhkKCG1pZGlfdXJsGAQgASgJUgdtaWRpVXJsEiMKDXNvdW5kZm9udF91cm'
    'wYBSABKAlSDHNvdW5kZm9udFVybBJEChNlZmZlY3RpdmVfbWlkaV9tb2RlGAYgASgOMhQua2Fu'
    'dGFoZS52MS5NaWRpTW9kZVIRZWZmZWN0aXZlTWlkaU1vZGUSFAoFcmVhZHkYByABKAhSBXJlYW'
    'R5EiQKDnJldHJ5X2FmdGVyX21zGAggASgFUgxyZXRyeUFmdGVyTXMSKgoGbHlyaWNzGAkgASgL'
    'MhIua2FudGFoZS52MS5MeXJpY3NSBmx5cmljcw==');

@$core.Deprecated('Use getPlaybackResponseDescriptor instead')
const GetPlaybackResponse$json = {
  '1': 'GetPlaybackResponse',
  '2': [
    {
      '1': 'playback',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Playback',
      '10': 'playback'
    },
  ],
};

/// Descriptor for `GetPlaybackResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getPlaybackResponseDescriptor = $convert.base64Decode(
    'ChNHZXRQbGF5YmFja1Jlc3BvbnNlEjAKCHBsYXliYWNrGAEgASgLMhQua2FudGFoZS52MS5QbG'
    'F5YmFja1IIcGxheWJhY2s=');

@$core.Deprecated('Use getBackgroundRequestDescriptor instead')
const GetBackgroundRequest$json = {
  '1': 'GetBackgroundRequest',
};

/// Descriptor for `GetBackgroundRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getBackgroundRequestDescriptor =
    $convert.base64Decode('ChRHZXRCYWNrZ3JvdW5kUmVxdWVzdA==');

@$core.Deprecated('Use getBackgroundResponseDescriptor instead')
const GetBackgroundResponse$json = {
  '1': 'GetBackgroundResponse',
  '2': [
    {'1': 'enabled', '3': 1, '4': 1, '5': 8, '10': 'enabled'},
    {'1': 'shuffle', '3': 2, '4': 1, '5': 8, '10': 'shuffle'},
    {
      '1': 'videos',
      '3': 3,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Video',
      '10': 'videos'
    },
  ],
};

/// Descriptor for `GetBackgroundResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getBackgroundResponseDescriptor = $convert.base64Decode(
    'ChVHZXRCYWNrZ3JvdW5kUmVzcG9uc2USGAoHZW5hYmxlZBgBIAEoCFIHZW5hYmxlZBIYCgdzaH'
    'VmZmxlGAIgASgIUgdzaHVmZmxlEikKBnZpZGVvcxgDIAMoCzIRLmthbnRhaGUudjEuVmlkZW9S'
    'BnZpZGVvcw==');

const $core.Map<$core.String, $core.dynamic> CatalogServiceBase$json = {
  '1': 'CatalogService',
  '2': [
    {
      '1': 'SearchSongs',
      '2': '.kantahe.v1.SearchSongsRequest',
      '3': '.kantahe.v1.SearchSongsResponse'
    },
    {
      '1': 'ListArtists',
      '2': '.kantahe.v1.ListArtistsRequest',
      '3': '.kantahe.v1.ListArtistsResponse'
    },
    {
      '1': 'GetSong',
      '2': '.kantahe.v1.GetSongRequest',
      '3': '.kantahe.v1.GetSongResponse'
    },
    {
      '1': 'GetLyrics',
      '2': '.kantahe.v1.GetLyricsRequest',
      '3': '.kantahe.v1.GetLyricsResponse'
    },
    {
      '1': 'GetPlayback',
      '2': '.kantahe.v1.GetPlaybackRequest',
      '3': '.kantahe.v1.GetPlaybackResponse'
    },
    {
      '1': 'GetBackground',
      '2': '.kantahe.v1.GetBackgroundRequest',
      '3': '.kantahe.v1.GetBackgroundResponse'
    },
  ],
};

@$core.Deprecated('Use catalogServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    CatalogServiceBase$messageJson = {
  '.kantahe.v1.SearchSongsRequest': SearchSongsRequest$json,
  '.kantahe.v1.SearchSongsResponse': SearchSongsResponse$json,
  '.kantahe.v1.Song': $0.Song$json,
  '.kantahe.v1.ListArtistsRequest': ListArtistsRequest$json,
  '.kantahe.v1.ListArtistsResponse': ListArtistsResponse$json,
  '.kantahe.v1.Artist': Artist$json,
  '.kantahe.v1.GetSongRequest': GetSongRequest$json,
  '.kantahe.v1.GetSongResponse': GetSongResponse$json,
  '.kantahe.v1.GetLyricsRequest': GetLyricsRequest$json,
  '.kantahe.v1.GetLyricsResponse': GetLyricsResponse$json,
  '.kantahe.v1.Lyrics': $0.Lyrics$json,
  '.kantahe.v1.LyricLine': $0.LyricLine$json,
  '.kantahe.v1.LyricWord': $0.LyricWord$json,
  '.kantahe.v1.GetPlaybackRequest': GetPlaybackRequest$json,
  '.kantahe.v1.GetPlaybackResponse': GetPlaybackResponse$json,
  '.kantahe.v1.Playback': Playback$json,
  '.kantahe.v1.GetBackgroundRequest': GetBackgroundRequest$json,
  '.kantahe.v1.GetBackgroundResponse': GetBackgroundResponse$json,
  '.kantahe.v1.Video': $0.Video$json,
};

/// Descriptor for `CatalogService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List catalogServiceDescriptor = $convert.base64Decode(
    'Cg5DYXRhbG9nU2VydmljZRJOCgtTZWFyY2hTb25ncxIeLmthbnRhaGUudjEuU2VhcmNoU29uZ3'
    'NSZXF1ZXN0Gh8ua2FudGFoZS52MS5TZWFyY2hTb25nc1Jlc3BvbnNlEk4KC0xpc3RBcnRpc3Rz'
    'Eh4ua2FudGFoZS52MS5MaXN0QXJ0aXN0c1JlcXVlc3QaHy5rYW50YWhlLnYxLkxpc3RBcnRpc3'
    'RzUmVzcG9uc2USQgoHR2V0U29uZxIaLmthbnRhaGUudjEuR2V0U29uZ1JlcXVlc3QaGy5rYW50'
    'YWhlLnYxLkdldFNvbmdSZXNwb25zZRJICglHZXRMeXJpY3MSHC5rYW50YWhlLnYxLkdldEx5cm'
    'ljc1JlcXVlc3QaHS5rYW50YWhlLnYxLkdldEx5cmljc1Jlc3BvbnNlEk4KC0dldFBsYXliYWNr'
    'Eh4ua2FudGFoZS52MS5HZXRQbGF5YmFja1JlcXVlc3QaHy5rYW50YWhlLnYxLkdldFBsYXliYW'
    'NrUmVzcG9uc2USVAoNR2V0QmFja2dyb3VuZBIgLmthbnRhaGUudjEuR2V0QmFja2dyb3VuZFJl'
    'cXVlc3QaIS5rYW50YWhlLnYxLkdldEJhY2tncm91bmRSZXNwb25zZQ==');
