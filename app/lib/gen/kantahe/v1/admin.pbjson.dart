// This is a generated file - do not edit.
//
// Generated from kantahe/v1/admin.proto.

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

@$core.Deprecated('Use removeScopeDescriptor instead')
const RemoveScope$json = {
  '1': 'RemoveScope',
  '2': [
    {'1': 'REMOVE_SCOPE_UNSPECIFIED', '2': 0},
    {'1': 'REMOVE_SCOPE_ALL', '2': 1},
    {'1': 'REMOVE_SCOPE_NO_MUSIC', '2': 2},
    {'1': 'REMOVE_SCOPE_BROKEN', '2': 3},
  ],
};

/// Descriptor for `RemoveScope`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List removeScopeDescriptor = $convert.base64Decode(
    'CgtSZW1vdmVTY29wZRIcChhSRU1PVkVfU0NPUEVfVU5TUEVDSUZJRUQQABIUChBSRU1PVkVfU0'
    'NPUEVfQUxMEAESGQoVUkVNT1ZFX1NDT1BFX05PX01VU0lDEAISFwoTUkVNT1ZFX1NDT1BFX0JS'
    'T0tFThAD');

@$core.Deprecated('Use listUsersRequestDescriptor instead')
const ListUsersRequest$json = {
  '1': 'ListUsersRequest',
};

/// Descriptor for `ListUsersRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listUsersRequestDescriptor =
    $convert.base64Decode('ChBMaXN0VXNlcnNSZXF1ZXN0');

@$core.Deprecated('Use listUsersResponseDescriptor instead')
const ListUsersResponse$json = {
  '1': 'ListUsersResponse',
  '2': [
    {
      '1': 'users',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.User',
      '10': 'users'
    },
  ],
};

/// Descriptor for `ListUsersResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listUsersResponseDescriptor = $convert.base64Decode(
    'ChFMaXN0VXNlcnNSZXNwb25zZRImCgV1c2VycxgBIAMoCzIQLmthbnRhaGUudjEuVXNlclIFdX'
    'NlcnM=');

@$core.Deprecated('Use createUserRequestDescriptor instead')
const CreateUserRequest$json = {
  '1': 'CreateUserRequest',
  '2': [
    {'1': 'email', '3': 1, '4': 1, '5': 9, '10': 'email'},
    {'1': 'display_name', '3': 2, '4': 1, '5': 9, '10': 'displayName'},
    {
      '1': 'temporary_password',
      '3': 3,
      '4': 1,
      '5': 9,
      '10': 'temporaryPassword'
    },
    {'1': 'admin', '3': 4, '4': 1, '5': 8, '10': 'admin'},
    {'1': 'uploader', '3': 5, '4': 1, '5': 8, '10': 'uploader'},
  ],
};

/// Descriptor for `CreateUserRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List createUserRequestDescriptor = $convert.base64Decode(
    'ChFDcmVhdGVVc2VyUmVxdWVzdBIUCgVlbWFpbBgBIAEoCVIFZW1haWwSIQoMZGlzcGxheV9uYW'
    '1lGAIgASgJUgtkaXNwbGF5TmFtZRItChJ0ZW1wb3JhcnlfcGFzc3dvcmQYAyABKAlSEXRlbXBv'
    'cmFyeVBhc3N3b3JkEhQKBWFkbWluGAQgASgIUgVhZG1pbhIaCgh1cGxvYWRlchgFIAEoCFIIdX'
    'Bsb2FkZXI=');

@$core.Deprecated('Use createUserResponseDescriptor instead')
const CreateUserResponse$json = {
  '1': 'CreateUserResponse',
  '2': [
    {
      '1': 'user',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.User',
      '10': 'user'
    },
  ],
};

/// Descriptor for `CreateUserResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List createUserResponseDescriptor = $convert.base64Decode(
    'ChJDcmVhdGVVc2VyUmVzcG9uc2USJAoEdXNlchgBIAEoCzIQLmthbnRhaGUudjEuVXNlclIEdX'
    'Nlcg==');

@$core.Deprecated('Use updateUserRequestDescriptor instead')
const UpdateUserRequest$json = {
  '1': 'UpdateUserRequest',
  '2': [
    {'1': 'user_id', '3': 1, '4': 1, '5': 9, '10': 'userId'},
    {
      '1': 'display_name',
      '3': 2,
      '4': 1,
      '5': 9,
      '9': 0,
      '10': 'displayName',
      '17': true
    },
    {'1': 'admin', '3': 3, '4': 1, '5': 8, '9': 1, '10': 'admin', '17': true},
    {
      '1': 'uploader',
      '3': 4,
      '4': 1,
      '5': 8,
      '9': 2,
      '10': 'uploader',
      '17': true
    },
    {
      '1': 'disabled',
      '3': 5,
      '4': 1,
      '5': 8,
      '9': 3,
      '10': 'disabled',
      '17': true
    },
  ],
  '8': [
    {'1': '_display_name'},
    {'1': '_admin'},
    {'1': '_uploader'},
    {'1': '_disabled'},
  ],
};

/// Descriptor for `UpdateUserRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateUserRequestDescriptor = $convert.base64Decode(
    'ChFVcGRhdGVVc2VyUmVxdWVzdBIXCgd1c2VyX2lkGAEgASgJUgZ1c2VySWQSJgoMZGlzcGxheV'
    '9uYW1lGAIgASgJSABSC2Rpc3BsYXlOYW1liAEBEhkKBWFkbWluGAMgASgISAFSBWFkbWluiAEB'
    'Eh8KCHVwbG9hZGVyGAQgASgISAJSCHVwbG9hZGVyiAEBEh8KCGRpc2FibGVkGAUgASgISANSCG'
    'Rpc2FibGVkiAEBQg8KDV9kaXNwbGF5X25hbWVCCAoGX2FkbWluQgsKCV91cGxvYWRlckILCglf'
    'ZGlzYWJsZWQ=');

@$core.Deprecated('Use updateUserResponseDescriptor instead')
const UpdateUserResponse$json = {
  '1': 'UpdateUserResponse',
  '2': [
    {
      '1': 'user',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.User',
      '10': 'user'
    },
  ],
};

/// Descriptor for `UpdateUserResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateUserResponseDescriptor = $convert.base64Decode(
    'ChJVcGRhdGVVc2VyUmVzcG9uc2USJAoEdXNlchgBIAEoCzIQLmthbnRhaGUudjEuVXNlclIEdX'
    'Nlcg==');

@$core.Deprecated('Use resetPasswordRequestDescriptor instead')
const ResetPasswordRequest$json = {
  '1': 'ResetPasswordRequest',
  '2': [
    {'1': 'user_id', '3': 1, '4': 1, '5': 9, '10': 'userId'},
    {
      '1': 'temporary_password',
      '3': 2,
      '4': 1,
      '5': 9,
      '10': 'temporaryPassword'
    },
  ],
};

/// Descriptor for `ResetPasswordRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List resetPasswordRequestDescriptor = $convert.base64Decode(
    'ChRSZXNldFBhc3N3b3JkUmVxdWVzdBIXCgd1c2VyX2lkGAEgASgJUgZ1c2VySWQSLQoSdGVtcG'
    '9yYXJ5X3Bhc3N3b3JkGAIgASgJUhF0ZW1wb3JhcnlQYXNzd29yZA==');

@$core.Deprecated('Use resetPasswordResponseDescriptor instead')
const ResetPasswordResponse$json = {
  '1': 'ResetPasswordResponse',
};

/// Descriptor for `ResetPasswordResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List resetPasswordResponseDescriptor =
    $convert.base64Decode('ChVSZXNldFBhc3N3b3JkUmVzcG9uc2U=');

@$core.Deprecated('Use deleteUserRequestDescriptor instead')
const DeleteUserRequest$json = {
  '1': 'DeleteUserRequest',
  '2': [
    {'1': 'user_id', '3': 1, '4': 1, '5': 9, '10': 'userId'},
  ],
};

/// Descriptor for `DeleteUserRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deleteUserRequestDescriptor = $convert.base64Decode(
    'ChFEZWxldGVVc2VyUmVxdWVzdBIXCgd1c2VyX2lkGAEgASgJUgZ1c2VySWQ=');

@$core.Deprecated('Use deleteUserResponseDescriptor instead')
const DeleteUserResponse$json = {
  '1': 'DeleteUserResponse',
};

/// Descriptor for `DeleteUserResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deleteUserResponseDescriptor =
    $convert.base64Decode('ChJEZWxldGVVc2VyUmVzcG9uc2U=');

@$core.Deprecated('Use revokeUserDevicesRequestDescriptor instead')
const RevokeUserDevicesRequest$json = {
  '1': 'RevokeUserDevicesRequest',
  '2': [
    {'1': 'user_id', '3': 1, '4': 1, '5': 9, '10': 'userId'},
  ],
};

/// Descriptor for `RevokeUserDevicesRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List revokeUserDevicesRequestDescriptor =
    $convert.base64Decode(
        'ChhSZXZva2VVc2VyRGV2aWNlc1JlcXVlc3QSFwoHdXNlcl9pZBgBIAEoCVIGdXNlcklk');

@$core.Deprecated('Use revokeUserDevicesResponseDescriptor instead')
const RevokeUserDevicesResponse$json = {
  '1': 'RevokeUserDevicesResponse',
  '2': [
    {'1': 'revoked', '3': 1, '4': 1, '5': 5, '10': 'revoked'},
  ],
};

/// Descriptor for `RevokeUserDevicesResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List revokeUserDevicesResponseDescriptor =
    $convert.base64Decode(
        'ChlSZXZva2VVc2VyRGV2aWNlc1Jlc3BvbnNlEhgKB3Jldm9rZWQYASABKAVSB3Jldm9rZWQ=');

@$core.Deprecated('Use updateSongRequestDescriptor instead')
const UpdateSongRequest$json = {
  '1': 'UpdateSongRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'title', '3': 2, '4': 1, '5': 9, '9': 0, '10': 'title', '17': true},
    {'1': 'artist', '3': 3, '4': 1, '5': 9, '9': 1, '10': 'artist', '17': true},
  ],
  '8': [
    {'1': '_title'},
    {'1': '_artist'},
  ],
};

/// Descriptor for `UpdateSongRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateSongRequestDescriptor = $convert.base64Decode(
    'ChFVcGRhdGVTb25nUmVxdWVzdBIWCgZudW1iZXIYASABKAlSBm51bWJlchIZCgV0aXRsZRgCIA'
    'EoCUgAUgV0aXRsZYgBARIbCgZhcnRpc3QYAyABKAlIAVIGYXJ0aXN0iAEBQggKBl90aXRsZUIJ'
    'CgdfYXJ0aXN0');

@$core.Deprecated('Use updateSongResponseDescriptor instead')
const UpdateSongResponse$json = {
  '1': 'UpdateSongResponse',
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

/// Descriptor for `UpdateSongResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateSongResponseDescriptor = $convert.base64Decode(
    'ChJVcGRhdGVTb25nUmVzcG9uc2USJAoEc29uZxgBIAEoCzIQLmthbnRhaGUudjEuU29uZ1IEc2'
    '9uZw==');

@$core.Deprecated('Use deleteSongRequestDescriptor instead')
const DeleteSongRequest$json = {
  '1': 'DeleteSongRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'keep_file', '3': 2, '4': 1, '5': 8, '10': 'keepFile'},
  ],
};

/// Descriptor for `DeleteSongRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deleteSongRequestDescriptor = $convert.base64Decode(
    'ChFEZWxldGVTb25nUmVxdWVzdBIWCgZudW1iZXIYASABKAlSBm51bWJlchIbCglrZWVwX2ZpbG'
    'UYAiABKAhSCGtlZXBGaWxl');

@$core.Deprecated('Use removeSongsRequestDescriptor instead')
const RemoveSongsRequest$json = {
  '1': 'RemoveSongsRequest',
  '2': [
    {
      '1': 'scope',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.RemoveScope',
      '10': 'scope'
    },
    {'1': 'delete_files', '3': 2, '4': 1, '5': 8, '10': 'deleteFiles'},
  ],
};

/// Descriptor for `RemoveSongsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List removeSongsRequestDescriptor = $convert.base64Decode(
    'ChJSZW1vdmVTb25nc1JlcXVlc3QSLQoFc2NvcGUYASABKA4yFy5rYW50YWhlLnYxLlJlbW92ZV'
    'Njb3BlUgVzY29wZRIhCgxkZWxldGVfZmlsZXMYAiABKAhSC2RlbGV0ZUZpbGVz');

@$core.Deprecated('Use removeSongsResponseDescriptor instead')
const RemoveSongsResponse$json = {
  '1': 'RemoveSongsResponse',
  '2': [
    {'1': 'removed', '3': 1, '4': 1, '5': 5, '10': 'removed'},
    {'1': 'files_deleted', '3': 2, '4': 1, '5': 5, '10': 'filesDeleted'},
    {'1': 'files_failed', '3': 3, '4': 1, '5': 5, '10': 'filesFailed'},
  ],
};

/// Descriptor for `RemoveSongsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List removeSongsResponseDescriptor = $convert.base64Decode(
    'ChNSZW1vdmVTb25nc1Jlc3BvbnNlEhgKB3JlbW92ZWQYASABKAVSB3JlbW92ZWQSIwoNZmlsZX'
    'NfZGVsZXRlZBgCIAEoBVIMZmlsZXNEZWxldGVkEiEKDGZpbGVzX2ZhaWxlZBgDIAEoBVILZmls'
    'ZXNGYWlsZWQ=');

@$core.Deprecated('Use checkLibraryRequestDescriptor instead')
const CheckLibraryRequest$json = {
  '1': 'CheckLibraryRequest',
};

/// Descriptor for `CheckLibraryRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List checkLibraryRequestDescriptor =
    $convert.base64Decode('ChNDaGVja0xpYnJhcnlSZXF1ZXN0');

@$core.Deprecated('Use checkLibraryResponseDescriptor instead')
const CheckLibraryResponse$json = {
  '1': 'CheckLibraryResponse',
  '2': [
    {'1': 'checked', '3': 1, '4': 1, '5': 5, '10': 'checked'},
    {'1': 'total', '3': 2, '4': 1, '5': 5, '10': 'total'},
    {'1': 'broken', '3': 3, '4': 1, '5': 5, '10': 'broken'},
    {'1': 'done', '3': 4, '4': 1, '5': 8, '10': 'done'},
  ],
};

/// Descriptor for `CheckLibraryResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List checkLibraryResponseDescriptor = $convert.base64Decode(
    'ChRDaGVja0xpYnJhcnlSZXNwb25zZRIYCgdjaGVja2VkGAEgASgFUgdjaGVja2VkEhQKBXRvdG'
    'FsGAIgASgFUgV0b3RhbBIWCgZicm9rZW4YAyABKAVSBmJyb2tlbhISCgRkb25lGAQgASgIUgRk'
    'b25l');

@$core.Deprecated('Use listBrokenSongsRequestDescriptor instead')
const ListBrokenSongsRequest$json = {
  '1': 'ListBrokenSongsRequest',
  '2': [
    {'1': 'page_token', '3': 1, '4': 1, '5': 9, '10': 'pageToken'},
    {'1': 'page_size', '3': 2, '4': 1, '5': 5, '10': 'pageSize'},
  ],
};

/// Descriptor for `ListBrokenSongsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listBrokenSongsRequestDescriptor =
    $convert.base64Decode(
        'ChZMaXN0QnJva2VuU29uZ3NSZXF1ZXN0Eh0KCnBhZ2VfdG9rZW4YASABKAlSCXBhZ2VUb2tlbh'
        'IbCglwYWdlX3NpemUYAiABKAVSCHBhZ2VTaXpl');

@$core.Deprecated('Use brokenSongDescriptor instead')
const BrokenSong$json = {
  '1': 'BrokenSong',
  '2': [
    {
      '1': 'song',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'song'
    },
    {'1': 'reason', '3': 2, '4': 1, '5': 9, '10': 'reason'},
  ],
};

/// Descriptor for `BrokenSong`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List brokenSongDescriptor = $convert.base64Decode(
    'CgpCcm9rZW5Tb25nEiQKBHNvbmcYASABKAsyEC5rYW50YWhlLnYxLlNvbmdSBHNvbmcSFgoGcm'
    'Vhc29uGAIgASgJUgZyZWFzb24=');

@$core.Deprecated('Use listBrokenSongsResponseDescriptor instead')
const ListBrokenSongsResponse$json = {
  '1': 'ListBrokenSongsResponse',
  '2': [
    {
      '1': 'songs',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.BrokenSong',
      '10': 'songs'
    },
    {'1': 'next_page_token', '3': 2, '4': 1, '5': 9, '10': 'nextPageToken'},
    {'1': 'total', '3': 3, '4': 1, '5': 5, '10': 'total'},
  ],
};

/// Descriptor for `ListBrokenSongsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listBrokenSongsResponseDescriptor = $convert.base64Decode(
    'ChdMaXN0QnJva2VuU29uZ3NSZXNwb25zZRIsCgVzb25ncxgBIAMoCzIWLmthbnRhaGUudjEuQn'
    'Jva2VuU29uZ1IFc29uZ3MSJgoPbmV4dF9wYWdlX3Rva2VuGAIgASgJUg1uZXh0UGFnZVRva2Vu'
    'EhQKBXRvdGFsGAMgASgFUgV0b3RhbA==');

@$core.Deprecated('Use deleteSongResponseDescriptor instead')
const DeleteSongResponse$json = {
  '1': 'DeleteSongResponse',
};

/// Descriptor for `DeleteSongResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deleteSongResponseDescriptor =
    $convert.base64Decode('ChJEZWxldGVTb25nUmVzcG9uc2U=');

@$core.Deprecated('Use rescanRequestDescriptor instead')
const RescanRequest$json = {
  '1': 'RescanRequest',
};

/// Descriptor for `RescanRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List rescanRequestDescriptor =
    $convert.base64Decode('Cg1SZXNjYW5SZXF1ZXN0');

@$core.Deprecated('Use rescanResponseDescriptor instead')
const RescanResponse$json = {
  '1': 'RescanResponse',
  '2': [
    {'1': 'added', '3': 1, '4': 1, '5': 5, '10': 'added'},
    {'1': 'updated', '3': 2, '4': 1, '5': 5, '10': 'updated'},
    {'1': 'removed', '3': 3, '4': 1, '5': 5, '10': 'removed'},
    {'1': 'failed', '3': 4, '4': 1, '5': 5, '10': 'failed'},
  ],
};

/// Descriptor for `RescanResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List rescanResponseDescriptor = $convert.base64Decode(
    'Cg5SZXNjYW5SZXNwb25zZRIUCgVhZGRlZBgBIAEoBVIFYWRkZWQSGAoHdXBkYXRlZBgCIAEoBV'
    'IHdXBkYXRlZBIYCgdyZW1vdmVkGAMgASgFUgdyZW1vdmVkEhYKBmZhaWxlZBgEIAEoBVIGZmFp'
    'bGVk');

@$core.Deprecated('Use getServerSettingsRequestDescriptor instead')
const GetServerSettingsRequest$json = {
  '1': 'GetServerSettingsRequest',
};

/// Descriptor for `GetServerSettingsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getServerSettingsRequestDescriptor =
    $convert.base64Decode('ChhHZXRTZXJ2ZXJTZXR0aW5nc1JlcXVlc3Q=');

@$core.Deprecated('Use getServerSettingsResponseDescriptor instead')
const GetServerSettingsResponse$json = {
  '1': 'GetServerSettingsResponse',
  '2': [
    {
      '1': 'settings',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.ServerSettings',
      '10': 'settings'
    },
  ],
};

/// Descriptor for `GetServerSettingsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getServerSettingsResponseDescriptor =
    $convert.base64Decode(
        'ChlHZXRTZXJ2ZXJTZXR0aW5nc1Jlc3BvbnNlEjYKCHNldHRpbmdzGAEgASgLMhoua2FudGFoZS'
        '52MS5TZXJ2ZXJTZXR0aW5nc1IIc2V0dGluZ3M=');

@$core.Deprecated('Use serverSettingsDescriptor instead')
const ServerSettings$json = {
  '1': 'ServerSettings',
  '2': [
    {'1': 'max_upload_bytes', '3': 1, '4': 1, '5': 3, '10': 'maxUploadBytes'},
    {'1': 'score_seconds', '3': 2, '4': 1, '5': 5, '10': 'scoreSeconds'},
    {'1': 'max_video_bytes', '3': 3, '4': 1, '5': 3, '10': 'maxVideoBytes'},
    {
      '1': 'background_enabled',
      '3': 4,
      '4': 1,
      '5': 8,
      '10': 'backgroundEnabled'
    },
    {
      '1': 'background_shuffle',
      '3': 5,
      '4': 1,
      '5': 8,
      '10': 'backgroundShuffle'
    },
  ],
};

/// Descriptor for `ServerSettings`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List serverSettingsDescriptor = $convert.base64Decode(
    'Cg5TZXJ2ZXJTZXR0aW5ncxIoChBtYXhfdXBsb2FkX2J5dGVzGAEgASgDUg5tYXhVcGxvYWRCeX'
    'RlcxIjCg1zY29yZV9zZWNvbmRzGAIgASgFUgxzY29yZVNlY29uZHMSJgoPbWF4X3ZpZGVvX2J5'
    'dGVzGAMgASgDUg1tYXhWaWRlb0J5dGVzEi0KEmJhY2tncm91bmRfZW5hYmxlZBgEIAEoCFIRYm'
    'Fja2dyb3VuZEVuYWJsZWQSLQoSYmFja2dyb3VuZF9zaHVmZmxlGAUgASgIUhFiYWNrZ3JvdW5k'
    'U2h1ZmZsZQ==');

@$core.Deprecated('Use updateServerSettingsRequestDescriptor instead')
const UpdateServerSettingsRequest$json = {
  '1': 'UpdateServerSettingsRequest',
  '2': [
    {
      '1': 'max_upload_bytes',
      '3': 1,
      '4': 1,
      '5': 3,
      '9': 0,
      '10': 'maxUploadBytes',
      '17': true
    },
    {
      '1': 'score_seconds',
      '3': 2,
      '4': 1,
      '5': 5,
      '9': 1,
      '10': 'scoreSeconds',
      '17': true
    },
    {
      '1': 'max_video_bytes',
      '3': 3,
      '4': 1,
      '5': 3,
      '9': 2,
      '10': 'maxVideoBytes',
      '17': true
    },
    {
      '1': 'background_enabled',
      '3': 4,
      '4': 1,
      '5': 8,
      '9': 3,
      '10': 'backgroundEnabled',
      '17': true
    },
    {
      '1': 'background_shuffle',
      '3': 5,
      '4': 1,
      '5': 8,
      '9': 4,
      '10': 'backgroundShuffle',
      '17': true
    },
  ],
  '8': [
    {'1': '_max_upload_bytes'},
    {'1': '_score_seconds'},
    {'1': '_max_video_bytes'},
    {'1': '_background_enabled'},
    {'1': '_background_shuffle'},
  ],
};

/// Descriptor for `UpdateServerSettingsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateServerSettingsRequestDescriptor = $convert.base64Decode(
    'ChtVcGRhdGVTZXJ2ZXJTZXR0aW5nc1JlcXVlc3QSLQoQbWF4X3VwbG9hZF9ieXRlcxgBIAEoA0'
    'gAUg5tYXhVcGxvYWRCeXRlc4gBARIoCg1zY29yZV9zZWNvbmRzGAIgASgFSAFSDHNjb3JlU2Vj'
    'b25kc4gBARIrCg9tYXhfdmlkZW9fYnl0ZXMYAyABKANIAlINbWF4VmlkZW9CeXRlc4gBARIyCh'
    'JiYWNrZ3JvdW5kX2VuYWJsZWQYBCABKAhIA1IRYmFja2dyb3VuZEVuYWJsZWSIAQESMgoSYmFj'
    'a2dyb3VuZF9zaHVmZmxlGAUgASgISARSEWJhY2tncm91bmRTaHVmZmxliAEBQhMKEV9tYXhfdX'
    'Bsb2FkX2J5dGVzQhAKDl9zY29yZV9zZWNvbmRzQhIKEF9tYXhfdmlkZW9fYnl0ZXNCFQoTX2Jh'
    'Y2tncm91bmRfZW5hYmxlZEIVChNfYmFja2dyb3VuZF9zaHVmZmxl');

@$core.Deprecated('Use updateServerSettingsResponseDescriptor instead')
const UpdateServerSettingsResponse$json = {
  '1': 'UpdateServerSettingsResponse',
  '2': [
    {
      '1': 'settings',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.ServerSettings',
      '10': 'settings'
    },
  ],
};

/// Descriptor for `UpdateServerSettingsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateServerSettingsResponseDescriptor =
    $convert.base64Decode(
        'ChxVcGRhdGVTZXJ2ZXJTZXR0aW5nc1Jlc3BvbnNlEjYKCHNldHRpbmdzGAEgASgLMhoua2FudG'
        'FoZS52MS5TZXJ2ZXJTZXR0aW5nc1IIc2V0dGluZ3M=');

@$core.Deprecated('Use listVideosRequestDescriptor instead')
const ListVideosRequest$json = {
  '1': 'ListVideosRequest',
};

/// Descriptor for `ListVideosRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listVideosRequestDescriptor =
    $convert.base64Decode('ChFMaXN0VmlkZW9zUmVxdWVzdA==');

@$core.Deprecated('Use listVideosResponseDescriptor instead')
const ListVideosResponse$json = {
  '1': 'ListVideosResponse',
  '2': [
    {
      '1': 'videos',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Video',
      '10': 'videos'
    },
  ],
};

/// Descriptor for `ListVideosResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listVideosResponseDescriptor = $convert.base64Decode(
    'ChJMaXN0VmlkZW9zUmVzcG9uc2USKQoGdmlkZW9zGAEgAygLMhEua2FudGFoZS52MS5WaWRlb1'
    'IGdmlkZW9z');

@$core.Deprecated('Use updateVideoRequestDescriptor instead')
const UpdateVideoRequest$json = {
  '1': 'UpdateVideoRequest',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {'1': 'name', '3': 2, '4': 1, '5': 9, '9': 0, '10': 'name', '17': true},
    {
      '1': 'enabled',
      '3': 3,
      '4': 1,
      '5': 8,
      '9': 1,
      '10': 'enabled',
      '17': true
    },
  ],
  '8': [
    {'1': '_name'},
    {'1': '_enabled'},
  ],
};

/// Descriptor for `UpdateVideoRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateVideoRequestDescriptor = $convert.base64Decode(
    'ChJVcGRhdGVWaWRlb1JlcXVlc3QSDgoCaWQYASABKAlSAmlkEhcKBG5hbWUYAiABKAlIAFIEbm'
    'FtZYgBARIdCgdlbmFibGVkGAMgASgISAFSB2VuYWJsZWSIAQFCBwoFX25hbWVCCgoIX2VuYWJs'
    'ZWQ=');

@$core.Deprecated('Use updateVideoResponseDescriptor instead')
const UpdateVideoResponse$json = {
  '1': 'UpdateVideoResponse',
  '2': [
    {
      '1': 'video',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Video',
      '10': 'video'
    },
  ],
};

/// Descriptor for `UpdateVideoResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateVideoResponseDescriptor = $convert.base64Decode(
    'ChNVcGRhdGVWaWRlb1Jlc3BvbnNlEicKBXZpZGVvGAEgASgLMhEua2FudGFoZS52MS5WaWRlb1'
    'IFdmlkZW8=');

@$core.Deprecated('Use reorderVideosRequestDescriptor instead')
const ReorderVideosRequest$json = {
  '1': 'ReorderVideosRequest',
  '2': [
    {'1': 'ids', '3': 1, '4': 3, '5': 9, '10': 'ids'},
  ],
};

/// Descriptor for `ReorderVideosRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reorderVideosRequestDescriptor = $convert
    .base64Decode('ChRSZW9yZGVyVmlkZW9zUmVxdWVzdBIQCgNpZHMYASADKAlSA2lkcw==');

@$core.Deprecated('Use reorderVideosResponseDescriptor instead')
const ReorderVideosResponse$json = {
  '1': 'ReorderVideosResponse',
  '2': [
    {
      '1': 'videos',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Video',
      '10': 'videos'
    },
  ],
};

/// Descriptor for `ReorderVideosResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reorderVideosResponseDescriptor = $convert.base64Decode(
    'ChVSZW9yZGVyVmlkZW9zUmVzcG9uc2USKQoGdmlkZW9zGAEgAygLMhEua2FudGFoZS52MS5WaW'
    'Rlb1IGdmlkZW9z');

@$core.Deprecated('Use deleteVideoRequestDescriptor instead')
const DeleteVideoRequest$json = {
  '1': 'DeleteVideoRequest',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
  ],
};

/// Descriptor for `DeleteVideoRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deleteVideoRequestDescriptor =
    $convert.base64Decode('ChJEZWxldGVWaWRlb1JlcXVlc3QSDgoCaWQYASABKAlSAmlk');

@$core.Deprecated('Use deleteVideoResponseDescriptor instead')
const DeleteVideoResponse$json = {
  '1': 'DeleteVideoResponse',
};

/// Descriptor for `DeleteVideoResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deleteVideoResponseDescriptor =
    $convert.base64Decode('ChNEZWxldGVWaWRlb1Jlc3BvbnNl');

const $core.Map<$core.String, $core.dynamic> AdminServiceBase$json = {
  '1': 'AdminService',
  '2': [
    {
      '1': 'ListUsers',
      '2': '.kantahe.v1.ListUsersRequest',
      '3': '.kantahe.v1.ListUsersResponse'
    },
    {
      '1': 'CreateUser',
      '2': '.kantahe.v1.CreateUserRequest',
      '3': '.kantahe.v1.CreateUserResponse'
    },
    {
      '1': 'UpdateUser',
      '2': '.kantahe.v1.UpdateUserRequest',
      '3': '.kantahe.v1.UpdateUserResponse'
    },
    {
      '1': 'ResetPassword',
      '2': '.kantahe.v1.ResetPasswordRequest',
      '3': '.kantahe.v1.ResetPasswordResponse'
    },
    {
      '1': 'DeleteUser',
      '2': '.kantahe.v1.DeleteUserRequest',
      '3': '.kantahe.v1.DeleteUserResponse'
    },
    {
      '1': 'RevokeUserDevices',
      '2': '.kantahe.v1.RevokeUserDevicesRequest',
      '3': '.kantahe.v1.RevokeUserDevicesResponse'
    },
    {
      '1': 'UpdateSong',
      '2': '.kantahe.v1.UpdateSongRequest',
      '3': '.kantahe.v1.UpdateSongResponse'
    },
    {
      '1': 'DeleteSong',
      '2': '.kantahe.v1.DeleteSongRequest',
      '3': '.kantahe.v1.DeleteSongResponse'
    },
    {
      '1': 'RemoveSongs',
      '2': '.kantahe.v1.RemoveSongsRequest',
      '3': '.kantahe.v1.RemoveSongsResponse'
    },
    {
      '1': 'CheckLibrary',
      '2': '.kantahe.v1.CheckLibraryRequest',
      '3': '.kantahe.v1.CheckLibraryResponse',
      '6': true
    },
    {
      '1': 'ListBrokenSongs',
      '2': '.kantahe.v1.ListBrokenSongsRequest',
      '3': '.kantahe.v1.ListBrokenSongsResponse'
    },
    {
      '1': 'ListVideos',
      '2': '.kantahe.v1.ListVideosRequest',
      '3': '.kantahe.v1.ListVideosResponse'
    },
    {
      '1': 'UpdateVideo',
      '2': '.kantahe.v1.UpdateVideoRequest',
      '3': '.kantahe.v1.UpdateVideoResponse'
    },
    {
      '1': 'ReorderVideos',
      '2': '.kantahe.v1.ReorderVideosRequest',
      '3': '.kantahe.v1.ReorderVideosResponse'
    },
    {
      '1': 'DeleteVideo',
      '2': '.kantahe.v1.DeleteVideoRequest',
      '3': '.kantahe.v1.DeleteVideoResponse'
    },
    {
      '1': 'Rescan',
      '2': '.kantahe.v1.RescanRequest',
      '3': '.kantahe.v1.RescanResponse'
    },
    {
      '1': 'GetServerSettings',
      '2': '.kantahe.v1.GetServerSettingsRequest',
      '3': '.kantahe.v1.GetServerSettingsResponse'
    },
    {
      '1': 'UpdateServerSettings',
      '2': '.kantahe.v1.UpdateServerSettingsRequest',
      '3': '.kantahe.v1.UpdateServerSettingsResponse'
    },
  ],
};

@$core.Deprecated('Use adminServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    AdminServiceBase$messageJson = {
  '.kantahe.v1.ListUsersRequest': ListUsersRequest$json,
  '.kantahe.v1.ListUsersResponse': ListUsersResponse$json,
  '.kantahe.v1.User': $0.User$json,
  '.kantahe.v1.CreateUserRequest': CreateUserRequest$json,
  '.kantahe.v1.CreateUserResponse': CreateUserResponse$json,
  '.kantahe.v1.UpdateUserRequest': UpdateUserRequest$json,
  '.kantahe.v1.UpdateUserResponse': UpdateUserResponse$json,
  '.kantahe.v1.ResetPasswordRequest': ResetPasswordRequest$json,
  '.kantahe.v1.ResetPasswordResponse': ResetPasswordResponse$json,
  '.kantahe.v1.DeleteUserRequest': DeleteUserRequest$json,
  '.kantahe.v1.DeleteUserResponse': DeleteUserResponse$json,
  '.kantahe.v1.RevokeUserDevicesRequest': RevokeUserDevicesRequest$json,
  '.kantahe.v1.RevokeUserDevicesResponse': RevokeUserDevicesResponse$json,
  '.kantahe.v1.UpdateSongRequest': UpdateSongRequest$json,
  '.kantahe.v1.UpdateSongResponse': UpdateSongResponse$json,
  '.kantahe.v1.Song': $0.Song$json,
  '.kantahe.v1.DeleteSongRequest': DeleteSongRequest$json,
  '.kantahe.v1.DeleteSongResponse': DeleteSongResponse$json,
  '.kantahe.v1.RemoveSongsRequest': RemoveSongsRequest$json,
  '.kantahe.v1.RemoveSongsResponse': RemoveSongsResponse$json,
  '.kantahe.v1.CheckLibraryRequest': CheckLibraryRequest$json,
  '.kantahe.v1.CheckLibraryResponse': CheckLibraryResponse$json,
  '.kantahe.v1.ListBrokenSongsRequest': ListBrokenSongsRequest$json,
  '.kantahe.v1.ListBrokenSongsResponse': ListBrokenSongsResponse$json,
  '.kantahe.v1.BrokenSong': BrokenSong$json,
  '.kantahe.v1.ListVideosRequest': ListVideosRequest$json,
  '.kantahe.v1.ListVideosResponse': ListVideosResponse$json,
  '.kantahe.v1.Video': $0.Video$json,
  '.kantahe.v1.UpdateVideoRequest': UpdateVideoRequest$json,
  '.kantahe.v1.UpdateVideoResponse': UpdateVideoResponse$json,
  '.kantahe.v1.ReorderVideosRequest': ReorderVideosRequest$json,
  '.kantahe.v1.ReorderVideosResponse': ReorderVideosResponse$json,
  '.kantahe.v1.DeleteVideoRequest': DeleteVideoRequest$json,
  '.kantahe.v1.DeleteVideoResponse': DeleteVideoResponse$json,
  '.kantahe.v1.RescanRequest': RescanRequest$json,
  '.kantahe.v1.RescanResponse': RescanResponse$json,
  '.kantahe.v1.GetServerSettingsRequest': GetServerSettingsRequest$json,
  '.kantahe.v1.GetServerSettingsResponse': GetServerSettingsResponse$json,
  '.kantahe.v1.ServerSettings': ServerSettings$json,
  '.kantahe.v1.UpdateServerSettingsRequest': UpdateServerSettingsRequest$json,
  '.kantahe.v1.UpdateServerSettingsResponse': UpdateServerSettingsResponse$json,
};

/// Descriptor for `AdminService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List adminServiceDescriptor = $convert.base64Decode(
    'CgxBZG1pblNlcnZpY2USSAoJTGlzdFVzZXJzEhwua2FudGFoZS52MS5MaXN0VXNlcnNSZXF1ZX'
    'N0Gh0ua2FudGFoZS52MS5MaXN0VXNlcnNSZXNwb25zZRJLCgpDcmVhdGVVc2VyEh0ua2FudGFo'
    'ZS52MS5DcmVhdGVVc2VyUmVxdWVzdBoeLmthbnRhaGUudjEuQ3JlYXRlVXNlclJlc3BvbnNlEk'
    'sKClVwZGF0ZVVzZXISHS5rYW50YWhlLnYxLlVwZGF0ZVVzZXJSZXF1ZXN0Gh4ua2FudGFoZS52'
    'MS5VcGRhdGVVc2VyUmVzcG9uc2USVAoNUmVzZXRQYXNzd29yZBIgLmthbnRhaGUudjEuUmVzZX'
    'RQYXNzd29yZFJlcXVlc3QaIS5rYW50YWhlLnYxLlJlc2V0UGFzc3dvcmRSZXNwb25zZRJLCgpE'
    'ZWxldGVVc2VyEh0ua2FudGFoZS52MS5EZWxldGVVc2VyUmVxdWVzdBoeLmthbnRhaGUudjEuRG'
    'VsZXRlVXNlclJlc3BvbnNlEmAKEVJldm9rZVVzZXJEZXZpY2VzEiQua2FudGFoZS52MS5SZXZv'
    'a2VVc2VyRGV2aWNlc1JlcXVlc3QaJS5rYW50YWhlLnYxLlJldm9rZVVzZXJEZXZpY2VzUmVzcG'
    '9uc2USSwoKVXBkYXRlU29uZxIdLmthbnRhaGUudjEuVXBkYXRlU29uZ1JlcXVlc3QaHi5rYW50'
    'YWhlLnYxLlVwZGF0ZVNvbmdSZXNwb25zZRJLCgpEZWxldGVTb25nEh0ua2FudGFoZS52MS5EZW'
    'xldGVTb25nUmVxdWVzdBoeLmthbnRhaGUudjEuRGVsZXRlU29uZ1Jlc3BvbnNlEk4KC1JlbW92'
    'ZVNvbmdzEh4ua2FudGFoZS52MS5SZW1vdmVTb25nc1JlcXVlc3QaHy5rYW50YWhlLnYxLlJlbW'
    '92ZVNvbmdzUmVzcG9uc2USUwoMQ2hlY2tMaWJyYXJ5Eh8ua2FudGFoZS52MS5DaGVja0xpYnJh'
    'cnlSZXF1ZXN0GiAua2FudGFoZS52MS5DaGVja0xpYnJhcnlSZXNwb25zZTABEloKD0xpc3RCcm'
    '9rZW5Tb25ncxIiLmthbnRhaGUudjEuTGlzdEJyb2tlblNvbmdzUmVxdWVzdBojLmthbnRhaGUu'
    'djEuTGlzdEJyb2tlblNvbmdzUmVzcG9uc2USSwoKTGlzdFZpZGVvcxIdLmthbnRhaGUudjEuTG'
    'lzdFZpZGVvc1JlcXVlc3QaHi5rYW50YWhlLnYxLkxpc3RWaWRlb3NSZXNwb25zZRJOCgtVcGRh'
    'dGVWaWRlbxIeLmthbnRhaGUudjEuVXBkYXRlVmlkZW9SZXF1ZXN0Gh8ua2FudGFoZS52MS5VcG'
    'RhdGVWaWRlb1Jlc3BvbnNlElQKDVJlb3JkZXJWaWRlb3MSIC5rYW50YWhlLnYxLlJlb3JkZXJW'
    'aWRlb3NSZXF1ZXN0GiEua2FudGFoZS52MS5SZW9yZGVyVmlkZW9zUmVzcG9uc2USTgoLRGVsZX'
    'RlVmlkZW8SHi5rYW50YWhlLnYxLkRlbGV0ZVZpZGVvUmVxdWVzdBofLmthbnRhaGUudjEuRGVs'
    'ZXRlVmlkZW9SZXNwb25zZRI/CgZSZXNjYW4SGS5rYW50YWhlLnYxLlJlc2NhblJlcXVlc3QaGi'
    '5rYW50YWhlLnYxLlJlc2NhblJlc3BvbnNlEmAKEUdldFNlcnZlclNldHRpbmdzEiQua2FudGFo'
    'ZS52MS5HZXRTZXJ2ZXJTZXR0aW5nc1JlcXVlc3QaJS5rYW50YWhlLnYxLkdldFNlcnZlclNldH'
    'RpbmdzUmVzcG9uc2USaQoUVXBkYXRlU2VydmVyU2V0dGluZ3MSJy5rYW50YWhlLnYxLlVwZGF0'
    'ZVNlcnZlclNldHRpbmdzUmVxdWVzdBooLmthbnRhaGUudjEuVXBkYXRlU2VydmVyU2V0dGluZ3'
    'NSZXNwb25zZQ==');
