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
  ],
};

/// Descriptor for `RemoveScope`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List removeScopeDescriptor = $convert.base64Decode(
    'CgtSZW1vdmVTY29wZRIcChhSRU1PVkVfU0NPUEVfVU5TUEVDSUZJRUQQABIUChBSRU1PVkVfU0'
    'NPUEVfQUxMEAESGQoVUkVNT1ZFX1NDT1BFX05PX01VU0lDEAI=');

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
  ],
};

/// Descriptor for `RemoveSongsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List removeSongsRequestDescriptor = $convert.base64Decode(
    'ChJSZW1vdmVTb25nc1JlcXVlc3QSLQoFc2NvcGUYASABKA4yFy5rYW50YWhlLnYxLlJlbW92ZV'
    'Njb3BlUgVzY29wZQ==');

@$core.Deprecated('Use removeSongsResponseDescriptor instead')
const RemoveSongsResponse$json = {
  '1': 'RemoveSongsResponse',
  '2': [
    {'1': 'removed', '3': 1, '4': 1, '5': 5, '10': 'removed'},
  ],
};

/// Descriptor for `RemoveSongsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List removeSongsResponseDescriptor =
    $convert.base64Decode(
        'ChNSZW1vdmVTb25nc1Jlc3BvbnNlEhgKB3JlbW92ZWQYASABKAVSB3JlbW92ZWQ=');

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
  ],
};

/// Descriptor for `ServerSettings`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List serverSettingsDescriptor = $convert.base64Decode(
    'Cg5TZXJ2ZXJTZXR0aW5ncxIoChBtYXhfdXBsb2FkX2J5dGVzGAEgASgDUg5tYXhVcGxvYWRCeX'
    'RlcxIjCg1zY29yZV9zZWNvbmRzGAIgASgFUgxzY29yZVNlY29uZHM=');

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
  ],
  '8': [
    {'1': '_max_upload_bytes'},
    {'1': '_score_seconds'},
  ],
};

/// Descriptor for `UpdateServerSettingsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateServerSettingsRequestDescriptor =
    $convert.base64Decode(
        'ChtVcGRhdGVTZXJ2ZXJTZXR0aW5nc1JlcXVlc3QSLQoQbWF4X3VwbG9hZF9ieXRlcxgBIAEoA0'
        'gAUg5tYXhVcGxvYWRCeXRlc4gBARIoCg1zY29yZV9zZWNvbmRzGAIgASgFSAFSDHNjb3JlU2Vj'
        'b25kc4gBAUITChFfbWF4X3VwbG9hZF9ieXRlc0IQCg5fc2NvcmVfc2Vjb25kcw==');

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
    '92ZVNvbmdzUmVzcG9uc2USPwoGUmVzY2FuEhkua2FudGFoZS52MS5SZXNjYW5SZXF1ZXN0Ghou'
    'a2FudGFoZS52MS5SZXNjYW5SZXNwb25zZRJgChFHZXRTZXJ2ZXJTZXR0aW5ncxIkLmthbnRhaG'
    'UudjEuR2V0U2VydmVyU2V0dGluZ3NSZXF1ZXN0GiUua2FudGFoZS52MS5HZXRTZXJ2ZXJTZXR0'
    'aW5nc1Jlc3BvbnNlEmkKFFVwZGF0ZVNlcnZlclNldHRpbmdzEicua2FudGFoZS52MS5VcGRhdG'
    'VTZXJ2ZXJTZXR0aW5nc1JlcXVlc3QaKC5rYW50YWhlLnYxLlVwZGF0ZVNlcnZlclNldHRpbmdz'
    'UmVzcG9uc2U=');
