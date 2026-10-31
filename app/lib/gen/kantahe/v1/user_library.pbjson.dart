// This is a generated file - do not edit.
//
// Generated from kantahe/v1/user_library.proto.

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

@$core.Deprecated('Use setFavouriteRequestDescriptor instead')
const SetFavouriteRequest$json = {
  '1': 'SetFavouriteRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'favourite', '3': 2, '4': 1, '5': 8, '10': 'favourite'},
  ],
};

/// Descriptor for `SetFavouriteRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setFavouriteRequestDescriptor = $convert.base64Decode(
    'ChNTZXRGYXZvdXJpdGVSZXF1ZXN0EhYKBm51bWJlchgBIAEoCVIGbnVtYmVyEhwKCWZhdm91cm'
    'l0ZRgCIAEoCFIJZmF2b3VyaXRl');

@$core.Deprecated('Use setFavouriteResponseDescriptor instead')
const SetFavouriteResponse$json = {
  '1': 'SetFavouriteResponse',
};

/// Descriptor for `SetFavouriteResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setFavouriteResponseDescriptor =
    $convert.base64Decode('ChRTZXRGYXZvdXJpdGVSZXNwb25zZQ==');

@$core.Deprecated('Use listFavouritesRequestDescriptor instead')
const ListFavouritesRequest$json = {
  '1': 'ListFavouritesRequest',
  '2': [
    {'1': 'page_token', '3': 1, '4': 1, '5': 9, '10': 'pageToken'},
    {'1': 'page_size', '3': 2, '4': 1, '5': 5, '10': 'pageSize'},
  ],
};

/// Descriptor for `ListFavouritesRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listFavouritesRequestDescriptor = $convert.base64Decode(
    'ChVMaXN0RmF2b3VyaXRlc1JlcXVlc3QSHQoKcGFnZV90b2tlbhgBIAEoCVIJcGFnZVRva2VuEh'
    'sKCXBhZ2Vfc2l6ZRgCIAEoBVIIcGFnZVNpemU=');

@$core.Deprecated('Use listFavouritesResponseDescriptor instead')
const ListFavouritesResponse$json = {
  '1': 'ListFavouritesResponse',
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

/// Descriptor for `ListFavouritesResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listFavouritesResponseDescriptor =
    $convert.base64Decode(
        'ChZMaXN0RmF2b3VyaXRlc1Jlc3BvbnNlEiYKBXNvbmdzGAEgAygLMhAua2FudGFoZS52MS5Tb2'
        '5nUgVzb25ncxImCg9uZXh0X3BhZ2VfdG9rZW4YAiABKAlSDW5leHRQYWdlVG9rZW4=');

@$core.Deprecated('Use listHistoryRequestDescriptor instead')
const ListHistoryRequest$json = {
  '1': 'ListHistoryRequest',
  '2': [
    {'1': 'page_token', '3': 1, '4': 1, '5': 9, '10': 'pageToken'},
    {'1': 'page_size', '3': 2, '4': 1, '5': 5, '10': 'pageSize'},
  ],
};

/// Descriptor for `ListHistoryRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listHistoryRequestDescriptor = $convert.base64Decode(
    'ChJMaXN0SGlzdG9yeVJlcXVlc3QSHQoKcGFnZV90b2tlbhgBIAEoCVIJcGFnZVRva2VuEhsKCX'
    'BhZ2Vfc2l6ZRgCIAEoBVIIcGFnZVNpemU=');

@$core.Deprecated('Use historyEntryDescriptor instead')
const HistoryEntry$json = {
  '1': 'HistoryEntry',
  '2': [
    {
      '1': 'song',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'song'
    },
    {'1': 'sung_at_unix', '3': 2, '4': 1, '5': 3, '10': 'sungAtUnix'},
    {'1': 'skipped', '3': 3, '4': 1, '5': 8, '10': 'skipped'},
    {'1': 'has_score', '3': 4, '4': 1, '5': 8, '10': 'hasScore'},
    {'1': 'score', '3': 5, '4': 1, '5': 5, '10': 'score'},
  ],
};

/// Descriptor for `HistoryEntry`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List historyEntryDescriptor = $convert.base64Decode(
    'CgxIaXN0b3J5RW50cnkSJAoEc29uZxgBIAEoCzIQLmthbnRhaGUudjEuU29uZ1IEc29uZxIgCg'
    'xzdW5nX2F0X3VuaXgYAiABKANSCnN1bmdBdFVuaXgSGAoHc2tpcHBlZBgDIAEoCFIHc2tpcHBl'
    'ZBIbCgloYXNfc2NvcmUYBCABKAhSCGhhc1Njb3JlEhQKBXNjb3JlGAUgASgFUgVzY29yZQ==');

@$core.Deprecated('Use listHistoryResponseDescriptor instead')
const ListHistoryResponse$json = {
  '1': 'ListHistoryResponse',
  '2': [
    {
      '1': 'entries',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.HistoryEntry',
      '10': 'entries'
    },
    {'1': 'next_page_token', '3': 2, '4': 1, '5': 9, '10': 'nextPageToken'},
  ],
};

/// Descriptor for `ListHistoryResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listHistoryResponseDescriptor = $convert.base64Decode(
    'ChNMaXN0SGlzdG9yeVJlc3BvbnNlEjIKB2VudHJpZXMYASADKAsyGC5rYW50YWhlLnYxLkhpc3'
    'RvcnlFbnRyeVIHZW50cmllcxImCg9uZXh0X3BhZ2VfdG9rZW4YAiABKAlSDW5leHRQYWdlVG9r'
    'ZW4=');

@$core.Deprecated('Use listPlaylistsRequestDescriptor instead')
const ListPlaylistsRequest$json = {
  '1': 'ListPlaylistsRequest',
};

/// Descriptor for `ListPlaylistsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listPlaylistsRequestDescriptor =
    $convert.base64Decode('ChRMaXN0UGxheWxpc3RzUmVxdWVzdA==');

@$core.Deprecated('Use playlistSummaryDescriptor instead')
const PlaylistSummary$json = {
  '1': 'PlaylistSummary',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {'1': 'name', '3': 2, '4': 1, '5': 9, '10': 'name'},
    {'1': 'song_count', '3': 3, '4': 1, '5': 5, '10': 'songCount'},
  ],
};

/// Descriptor for `PlaylistSummary`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List playlistSummaryDescriptor = $convert.base64Decode(
    'Cg9QbGF5bGlzdFN1bW1hcnkSDgoCaWQYASABKAlSAmlkEhIKBG5hbWUYAiABKAlSBG5hbWUSHQ'
    'oKc29uZ19jb3VudBgDIAEoBVIJc29uZ0NvdW50');

@$core.Deprecated('Use listPlaylistsResponseDescriptor instead')
const ListPlaylistsResponse$json = {
  '1': 'ListPlaylistsResponse',
  '2': [
    {
      '1': 'playlists',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.PlaylistSummary',
      '10': 'playlists'
    },
  ],
};

/// Descriptor for `ListPlaylistsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listPlaylistsResponseDescriptor = $convert.base64Decode(
    'ChVMaXN0UGxheWxpc3RzUmVzcG9uc2USOQoJcGxheWxpc3RzGAEgAygLMhsua2FudGFoZS52MS'
    '5QbGF5bGlzdFN1bW1hcnlSCXBsYXlsaXN0cw==');

@$core.Deprecated('Use getPlaylistRequestDescriptor instead')
const GetPlaylistRequest$json = {
  '1': 'GetPlaylistRequest',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
  ],
};

/// Descriptor for `GetPlaylistRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getPlaylistRequestDescriptor =
    $convert.base64Decode('ChJHZXRQbGF5bGlzdFJlcXVlc3QSDgoCaWQYASABKAlSAmlk');

@$core.Deprecated('Use playlistDescriptor instead')
const Playlist$json = {
  '1': 'Playlist',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {'1': 'name', '3': 2, '4': 1, '5': 9, '10': 'name'},
    {
      '1': 'songs',
      '3': 3,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'songs'
    },
  ],
};

/// Descriptor for `Playlist`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List playlistDescriptor = $convert.base64Decode(
    'CghQbGF5bGlzdBIOCgJpZBgBIAEoCVICaWQSEgoEbmFtZRgCIAEoCVIEbmFtZRImCgVzb25ncx'
    'gDIAMoCzIQLmthbnRhaGUudjEuU29uZ1IFc29uZ3M=');

@$core.Deprecated('Use getPlaylistResponseDescriptor instead')
const GetPlaylistResponse$json = {
  '1': 'GetPlaylistResponse',
  '2': [
    {
      '1': 'playlist',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Playlist',
      '10': 'playlist'
    },
  ],
};

/// Descriptor for `GetPlaylistResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getPlaylistResponseDescriptor = $convert.base64Decode(
    'ChNHZXRQbGF5bGlzdFJlc3BvbnNlEjAKCHBsYXlsaXN0GAEgASgLMhQua2FudGFoZS52MS5QbG'
    'F5bGlzdFIIcGxheWxpc3Q=');

@$core.Deprecated('Use createPlaylistRequestDescriptor instead')
const CreatePlaylistRequest$json = {
  '1': 'CreatePlaylistRequest',
  '2': [
    {'1': 'name', '3': 1, '4': 1, '5': 9, '10': 'name'},
    {'1': 'numbers', '3': 2, '4': 3, '5': 9, '10': 'numbers'},
  ],
};

/// Descriptor for `CreatePlaylistRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List createPlaylistRequestDescriptor = $convert.base64Decode(
    'ChVDcmVhdGVQbGF5bGlzdFJlcXVlc3QSEgoEbmFtZRgBIAEoCVIEbmFtZRIYCgdudW1iZXJzGA'
    'IgAygJUgdudW1iZXJz');

@$core.Deprecated('Use createPlaylistResponseDescriptor instead')
const CreatePlaylistResponse$json = {
  '1': 'CreatePlaylistResponse',
  '2': [
    {
      '1': 'playlist',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Playlist',
      '10': 'playlist'
    },
  ],
};

/// Descriptor for `CreatePlaylistResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List createPlaylistResponseDescriptor =
    $convert.base64Decode(
        'ChZDcmVhdGVQbGF5bGlzdFJlc3BvbnNlEjAKCHBsYXlsaXN0GAEgASgLMhQua2FudGFoZS52MS'
        '5QbGF5bGlzdFIIcGxheWxpc3Q=');

@$core.Deprecated('Use updatePlaylistRequestDescriptor instead')
const UpdatePlaylistRequest$json = {
  '1': 'UpdatePlaylistRequest',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {'1': 'name', '3': 2, '4': 1, '5': 9, '9': 0, '10': 'name', '17': true},
    {'1': 'replace_numbers', '3': 3, '4': 1, '5': 8, '10': 'replaceNumbers'},
    {'1': 'numbers', '3': 4, '4': 3, '5': 9, '10': 'numbers'},
  ],
  '8': [
    {'1': '_name'},
  ],
};

/// Descriptor for `UpdatePlaylistRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updatePlaylistRequestDescriptor = $convert.base64Decode(
    'ChVVcGRhdGVQbGF5bGlzdFJlcXVlc3QSDgoCaWQYASABKAlSAmlkEhcKBG5hbWUYAiABKAlIAF'
    'IEbmFtZYgBARInCg9yZXBsYWNlX251bWJlcnMYAyABKAhSDnJlcGxhY2VOdW1iZXJzEhgKB251'
    'bWJlcnMYBCADKAlSB251bWJlcnNCBwoFX25hbWU=');

@$core.Deprecated('Use updatePlaylistResponseDescriptor instead')
const UpdatePlaylistResponse$json = {
  '1': 'UpdatePlaylistResponse',
  '2': [
    {
      '1': 'playlist',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Playlist',
      '10': 'playlist'
    },
  ],
};

/// Descriptor for `UpdatePlaylistResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updatePlaylistResponseDescriptor =
    $convert.base64Decode(
        'ChZVcGRhdGVQbGF5bGlzdFJlc3BvbnNlEjAKCHBsYXlsaXN0GAEgASgLMhQua2FudGFoZS52MS'
        '5QbGF5bGlzdFIIcGxheWxpc3Q=');

@$core.Deprecated('Use deletePlaylistRequestDescriptor instead')
const DeletePlaylistRequest$json = {
  '1': 'DeletePlaylistRequest',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
  ],
};

/// Descriptor for `DeletePlaylistRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deletePlaylistRequestDescriptor = $convert
    .base64Decode('ChVEZWxldGVQbGF5bGlzdFJlcXVlc3QSDgoCaWQYASABKAlSAmlk');

@$core.Deprecated('Use deletePlaylistResponseDescriptor instead')
const DeletePlaylistResponse$json = {
  '1': 'DeletePlaylistResponse',
};

/// Descriptor for `DeletePlaylistResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deletePlaylistResponseDescriptor =
    $convert.base64Decode('ChZEZWxldGVQbGF5bGlzdFJlc3BvbnNl');

const $core.Map<$core.String, $core.dynamic> UserLibraryServiceBase$json = {
  '1': 'UserLibraryService',
  '2': [
    {
      '1': 'SetFavourite',
      '2': '.kantahe.v1.SetFavouriteRequest',
      '3': '.kantahe.v1.SetFavouriteResponse'
    },
    {
      '1': 'ListFavourites',
      '2': '.kantahe.v1.ListFavouritesRequest',
      '3': '.kantahe.v1.ListFavouritesResponse'
    },
    {
      '1': 'ListHistory',
      '2': '.kantahe.v1.ListHistoryRequest',
      '3': '.kantahe.v1.ListHistoryResponse'
    },
    {
      '1': 'ListPlaylists',
      '2': '.kantahe.v1.ListPlaylistsRequest',
      '3': '.kantahe.v1.ListPlaylistsResponse'
    },
    {
      '1': 'GetPlaylist',
      '2': '.kantahe.v1.GetPlaylistRequest',
      '3': '.kantahe.v1.GetPlaylistResponse'
    },
    {
      '1': 'CreatePlaylist',
      '2': '.kantahe.v1.CreatePlaylistRequest',
      '3': '.kantahe.v1.CreatePlaylistResponse'
    },
    {
      '1': 'UpdatePlaylist',
      '2': '.kantahe.v1.UpdatePlaylistRequest',
      '3': '.kantahe.v1.UpdatePlaylistResponse'
    },
    {
      '1': 'DeletePlaylist',
      '2': '.kantahe.v1.DeletePlaylistRequest',
      '3': '.kantahe.v1.DeletePlaylistResponse'
    },
  ],
};

@$core.Deprecated('Use userLibraryServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    UserLibraryServiceBase$messageJson = {
  '.kantahe.v1.SetFavouriteRequest': SetFavouriteRequest$json,
  '.kantahe.v1.SetFavouriteResponse': SetFavouriteResponse$json,
  '.kantahe.v1.ListFavouritesRequest': ListFavouritesRequest$json,
  '.kantahe.v1.ListFavouritesResponse': ListFavouritesResponse$json,
  '.kantahe.v1.Song': $0.Song$json,
  '.kantahe.v1.ListHistoryRequest': ListHistoryRequest$json,
  '.kantahe.v1.ListHistoryResponse': ListHistoryResponse$json,
  '.kantahe.v1.HistoryEntry': HistoryEntry$json,
  '.kantahe.v1.ListPlaylistsRequest': ListPlaylistsRequest$json,
  '.kantahe.v1.ListPlaylistsResponse': ListPlaylistsResponse$json,
  '.kantahe.v1.PlaylistSummary': PlaylistSummary$json,
  '.kantahe.v1.GetPlaylistRequest': GetPlaylistRequest$json,
  '.kantahe.v1.GetPlaylistResponse': GetPlaylistResponse$json,
  '.kantahe.v1.Playlist': Playlist$json,
  '.kantahe.v1.CreatePlaylistRequest': CreatePlaylistRequest$json,
  '.kantahe.v1.CreatePlaylistResponse': CreatePlaylistResponse$json,
  '.kantahe.v1.UpdatePlaylistRequest': UpdatePlaylistRequest$json,
  '.kantahe.v1.UpdatePlaylistResponse': UpdatePlaylistResponse$json,
  '.kantahe.v1.DeletePlaylistRequest': DeletePlaylistRequest$json,
  '.kantahe.v1.DeletePlaylistResponse': DeletePlaylistResponse$json,
};

/// Descriptor for `UserLibraryService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List userLibraryServiceDescriptor = $convert.base64Decode(
    'ChJVc2VyTGlicmFyeVNlcnZpY2USUQoMU2V0RmF2b3VyaXRlEh8ua2FudGFoZS52MS5TZXRGYX'
    'ZvdXJpdGVSZXF1ZXN0GiAua2FudGFoZS52MS5TZXRGYXZvdXJpdGVSZXNwb25zZRJXCg5MaXN0'
    'RmF2b3VyaXRlcxIhLmthbnRhaGUudjEuTGlzdEZhdm91cml0ZXNSZXF1ZXN0GiIua2FudGFoZS'
    '52MS5MaXN0RmF2b3VyaXRlc1Jlc3BvbnNlEk4KC0xpc3RIaXN0b3J5Eh4ua2FudGFoZS52MS5M'
    'aXN0SGlzdG9yeVJlcXVlc3QaHy5rYW50YWhlLnYxLkxpc3RIaXN0b3J5UmVzcG9uc2USVAoNTG'
    'lzdFBsYXlsaXN0cxIgLmthbnRhaGUudjEuTGlzdFBsYXlsaXN0c1JlcXVlc3QaIS5rYW50YWhl'
    'LnYxLkxpc3RQbGF5bGlzdHNSZXNwb25zZRJOCgtHZXRQbGF5bGlzdBIeLmthbnRhaGUudjEuR2'
    'V0UGxheWxpc3RSZXF1ZXN0Gh8ua2FudGFoZS52MS5HZXRQbGF5bGlzdFJlc3BvbnNlElcKDkNy'
    'ZWF0ZVBsYXlsaXN0EiEua2FudGFoZS52MS5DcmVhdGVQbGF5bGlzdFJlcXVlc3QaIi5rYW50YW'
    'hlLnYxLkNyZWF0ZVBsYXlsaXN0UmVzcG9uc2USVwoOVXBkYXRlUGxheWxpc3QSIS5rYW50YWhl'
    'LnYxLlVwZGF0ZVBsYXlsaXN0UmVxdWVzdBoiLmthbnRhaGUudjEuVXBkYXRlUGxheWxpc3RSZX'
    'Nwb25zZRJXCg5EZWxldGVQbGF5bGlzdBIhLmthbnRhaGUudjEuRGVsZXRlUGxheWxpc3RSZXF1'
    'ZXN0GiIua2FudGFoZS52MS5EZWxldGVQbGF5bGlzdFJlc3BvbnNl');
