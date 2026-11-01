// This is a generated file - do not edit.
//
// Generated from kantahe/v1/auth.proto.

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

@$core.Deprecated('Use getServerInfoRequestDescriptor instead')
const GetServerInfoRequest$json = {
  '1': 'GetServerInfoRequest',
};

/// Descriptor for `GetServerInfoRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getServerInfoRequestDescriptor =
    $convert.base64Decode('ChRHZXRTZXJ2ZXJJbmZvUmVxdWVzdA==');

@$core.Deprecated('Use getServerInfoResponseDescriptor instead')
const GetServerInfoResponse$json = {
  '1': 'GetServerInfoResponse',
  '2': [
    {'1': 'version', '3': 1, '4': 1, '5': 9, '10': 'version'},
    {'1': 'setup_required', '3': 2, '4': 1, '5': 8, '10': 'setupRequired'},
    {'1': 'name', '3': 3, '4': 1, '5': 9, '10': 'name'},
  ],
};

/// Descriptor for `GetServerInfoResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getServerInfoResponseDescriptor = $convert.base64Decode(
    'ChVHZXRTZXJ2ZXJJbmZvUmVzcG9uc2USGAoHdmVyc2lvbhgBIAEoCVIHdmVyc2lvbhIlCg5zZX'
    'R1cF9yZXF1aXJlZBgCIAEoCFINc2V0dXBSZXF1aXJlZBISCgRuYW1lGAMgASgJUgRuYW1l');

@$core.Deprecated('Use setupRequestDescriptor instead')
const SetupRequest$json = {
  '1': 'SetupRequest',
  '2': [
    {'1': 'email', '3': 1, '4': 1, '5': 9, '10': 'email'},
    {'1': 'password', '3': 2, '4': 1, '5': 9, '10': 'password'},
    {'1': 'display_name', '3': 3, '4': 1, '5': 9, '10': 'displayName'},
    {'1': 'device_name', '3': 4, '4': 1, '5': 9, '10': 'deviceName'},
    {
      '1': 'device_type',
      '3': 5,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.DeviceType',
      '10': 'deviceType'
    },
  ],
};

/// Descriptor for `SetupRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setupRequestDescriptor = $convert.base64Decode(
    'CgxTZXR1cFJlcXVlc3QSFAoFZW1haWwYASABKAlSBWVtYWlsEhoKCHBhc3N3b3JkGAIgASgJUg'
    'hwYXNzd29yZBIhCgxkaXNwbGF5X25hbWUYAyABKAlSC2Rpc3BsYXlOYW1lEh8KC2RldmljZV9u'
    'YW1lGAQgASgJUgpkZXZpY2VOYW1lEjcKC2RldmljZV90eXBlGAUgASgOMhYua2FudGFoZS52MS'
    '5EZXZpY2VUeXBlUgpkZXZpY2VUeXBl');

@$core.Deprecated('Use setupResponseDescriptor instead')
const SetupResponse$json = {
  '1': 'SetupResponse',
  '2': [
    {
      '1': 'auth',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.AuthToken',
      '10': 'auth'
    },
  ],
};

/// Descriptor for `SetupResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setupResponseDescriptor = $convert.base64Decode(
    'Cg1TZXR1cFJlc3BvbnNlEikKBGF1dGgYASABKAsyFS5rYW50YWhlLnYxLkF1dGhUb2tlblIEYX'
    'V0aA==');

@$core.Deprecated('Use loginRequestDescriptor instead')
const LoginRequest$json = {
  '1': 'LoginRequest',
  '2': [
    {'1': 'email', '3': 1, '4': 1, '5': 9, '10': 'email'},
    {'1': 'password', '3': 2, '4': 1, '5': 9, '10': 'password'},
    {'1': 'device_name', '3': 3, '4': 1, '5': 9, '10': 'deviceName'},
    {
      '1': 'device_type',
      '3': 4,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.DeviceType',
      '10': 'deviceType'
    },
  ],
};

/// Descriptor for `LoginRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List loginRequestDescriptor = $convert.base64Decode(
    'CgxMb2dpblJlcXVlc3QSFAoFZW1haWwYASABKAlSBWVtYWlsEhoKCHBhc3N3b3JkGAIgASgJUg'
    'hwYXNzd29yZBIfCgtkZXZpY2VfbmFtZRgDIAEoCVIKZGV2aWNlTmFtZRI3CgtkZXZpY2VfdHlw'
    'ZRgEIAEoDjIWLmthbnRhaGUudjEuRGV2aWNlVHlwZVIKZGV2aWNlVHlwZQ==');

@$core.Deprecated('Use loginResponseDescriptor instead')
const LoginResponse$json = {
  '1': 'LoginResponse',
  '2': [
    {
      '1': 'auth',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.AuthToken',
      '10': 'auth'
    },
  ],
};

/// Descriptor for `LoginResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List loginResponseDescriptor = $convert.base64Decode(
    'Cg1Mb2dpblJlc3BvbnNlEikKBGF1dGgYASABKAsyFS5rYW50YWhlLnYxLkF1dGhUb2tlblIEYX'
    'V0aA==');

@$core.Deprecated('Use logoutRequestDescriptor instead')
const LogoutRequest$json = {
  '1': 'LogoutRequest',
};

/// Descriptor for `LogoutRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List logoutRequestDescriptor =
    $convert.base64Decode('Cg1Mb2dvdXRSZXF1ZXN0');

@$core.Deprecated('Use logoutResponseDescriptor instead')
const LogoutResponse$json = {
  '1': 'LogoutResponse',
};

/// Descriptor for `LogoutResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List logoutResponseDescriptor =
    $convert.base64Decode('Cg5Mb2dvdXRSZXNwb25zZQ==');

@$core.Deprecated('Use changePasswordRequestDescriptor instead')
const ChangePasswordRequest$json = {
  '1': 'ChangePasswordRequest',
  '2': [
    {'1': 'current_password', '3': 1, '4': 1, '5': 9, '10': 'currentPassword'},
    {'1': 'new_password', '3': 2, '4': 1, '5': 9, '10': 'newPassword'},
  ],
};

/// Descriptor for `ChangePasswordRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List changePasswordRequestDescriptor = $convert.base64Decode(
    'ChVDaGFuZ2VQYXNzd29yZFJlcXVlc3QSKQoQY3VycmVudF9wYXNzd29yZBgBIAEoCVIPY3Vycm'
    'VudFBhc3N3b3JkEiEKDG5ld19wYXNzd29yZBgCIAEoCVILbmV3UGFzc3dvcmQ=');

@$core.Deprecated('Use changePasswordResponseDescriptor instead')
const ChangePasswordResponse$json = {
  '1': 'ChangePasswordResponse',
};

/// Descriptor for `ChangePasswordResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List changePasswordResponseDescriptor =
    $convert.base64Decode('ChZDaGFuZ2VQYXNzd29yZFJlc3BvbnNl');

@$core.Deprecated('Use meRequestDescriptor instead')
const MeRequest$json = {
  '1': 'MeRequest',
};

/// Descriptor for `MeRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List meRequestDescriptor =
    $convert.base64Decode('CglNZVJlcXVlc3Q=');

@$core.Deprecated('Use meResponseDescriptor instead')
const MeResponse$json = {
  '1': 'MeResponse',
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

/// Descriptor for `MeResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List meResponseDescriptor = $convert.base64Decode(
    'CgpNZVJlc3BvbnNlEiQKBHVzZXIYASABKAsyEC5rYW50YWhlLnYxLlVzZXJSBHVzZXI=');

@$core.Deprecated('Use listMyDevicesRequestDescriptor instead')
const ListMyDevicesRequest$json = {
  '1': 'ListMyDevicesRequest',
};

/// Descriptor for `ListMyDevicesRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listMyDevicesRequestDescriptor =
    $convert.base64Decode('ChRMaXN0TXlEZXZpY2VzUmVxdWVzdA==');

@$core.Deprecated('Use listMyDevicesResponseDescriptor instead')
const ListMyDevicesResponse$json = {
  '1': 'ListMyDevicesResponse',
  '2': [
    {
      '1': 'devices',
      '3': 1,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Device',
      '10': 'devices'
    },
  ],
};

/// Descriptor for `ListMyDevicesResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List listMyDevicesResponseDescriptor = $convert.base64Decode(
    'ChVMaXN0TXlEZXZpY2VzUmVzcG9uc2USLAoHZGV2aWNlcxgBIAMoCzISLmthbnRhaGUudjEuRG'
    'V2aWNlUgdkZXZpY2Vz');

@$core.Deprecated('Use revokeDeviceRequestDescriptor instead')
const RevokeDeviceRequest$json = {
  '1': 'RevokeDeviceRequest',
  '2': [
    {'1': 'device_id', '3': 1, '4': 1, '5': 9, '10': 'deviceId'},
  ],
};

/// Descriptor for `RevokeDeviceRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List revokeDeviceRequestDescriptor =
    $convert.base64Decode(
        'ChNSZXZva2VEZXZpY2VSZXF1ZXN0EhsKCWRldmljZV9pZBgBIAEoCVIIZGV2aWNlSWQ=');

@$core.Deprecated('Use revokeDeviceResponseDescriptor instead')
const RevokeDeviceResponse$json = {
  '1': 'RevokeDeviceResponse',
};

/// Descriptor for `RevokeDeviceResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List revokeDeviceResponseDescriptor =
    $convert.base64Decode('ChRSZXZva2VEZXZpY2VSZXNwb25zZQ==');

@$core.Deprecated('Use startCodeLoginRequestDescriptor instead')
const StartCodeLoginRequest$json = {
  '1': 'StartCodeLoginRequest',
  '2': [
    {'1': 'device_name', '3': 1, '4': 1, '5': 9, '10': 'deviceName'},
    {
      '1': 'device_type',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.DeviceType',
      '10': 'deviceType'
    },
  ],
};

/// Descriptor for `StartCodeLoginRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List startCodeLoginRequestDescriptor = $convert.base64Decode(
    'ChVTdGFydENvZGVMb2dpblJlcXVlc3QSHwoLZGV2aWNlX25hbWUYASABKAlSCmRldmljZU5hbW'
    'USNwoLZGV2aWNlX3R5cGUYAiABKA4yFi5rYW50YWhlLnYxLkRldmljZVR5cGVSCmRldmljZVR5'
    'cGU=');

@$core.Deprecated('Use startCodeLoginResponseDescriptor instead')
const StartCodeLoginResponse$json = {
  '1': 'StartCodeLoginResponse',
  '2': [
    {'1': 'login_id', '3': 1, '4': 1, '5': 9, '10': 'loginId'},
    {'1': 'code', '3': 2, '4': 1, '5': 9, '10': 'code'},
    {'1': 'expires_at_unix', '3': 3, '4': 1, '5': 3, '10': 'expiresAtUnix'},
    {'1': 'approve_url', '3': 4, '4': 1, '5': 9, '10': 'approveUrl'},
  ],
};

/// Descriptor for `StartCodeLoginResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List startCodeLoginResponseDescriptor = $convert.base64Decode(
    'ChZTdGFydENvZGVMb2dpblJlc3BvbnNlEhkKCGxvZ2luX2lkGAEgASgJUgdsb2dpbklkEhIKBG'
    'NvZGUYAiABKAlSBGNvZGUSJgoPZXhwaXJlc19hdF91bml4GAMgASgDUg1leHBpcmVzQXRVbml4'
    'Eh8KC2FwcHJvdmVfdXJsGAQgASgJUgphcHByb3ZlVXJs');

@$core.Deprecated('Use waitCodeLoginRequestDescriptor instead')
const WaitCodeLoginRequest$json = {
  '1': 'WaitCodeLoginRequest',
  '2': [
    {'1': 'login_id', '3': 1, '4': 1, '5': 9, '10': 'loginId'},
  ],
};

/// Descriptor for `WaitCodeLoginRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List waitCodeLoginRequestDescriptor =
    $convert.base64Decode(
        'ChRXYWl0Q29kZUxvZ2luUmVxdWVzdBIZCghsb2dpbl9pZBgBIAEoCVIHbG9naW5JZA==');

@$core.Deprecated('Use waitCodeLoginResponseDescriptor instead')
const WaitCodeLoginResponse$json = {
  '1': 'WaitCodeLoginResponse',
  '2': [
    {
      '1': 'approved',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.AuthToken',
      '9': 0,
      '10': 'approved'
    },
    {'1': 'expired', '3': 2, '4': 1, '5': 8, '9': 0, '10': 'expired'},
  ],
  '8': [
    {'1': 'result'},
  ],
};

/// Descriptor for `WaitCodeLoginResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List waitCodeLoginResponseDescriptor = $convert.base64Decode(
    'ChVXYWl0Q29kZUxvZ2luUmVzcG9uc2USMwoIYXBwcm92ZWQYASABKAsyFS5rYW50YWhlLnYxLk'
    'F1dGhUb2tlbkgAUghhcHByb3ZlZBIaCgdleHBpcmVkGAIgASgISABSB2V4cGlyZWRCCAoGcmVz'
    'dWx0');

@$core.Deprecated('Use approveCodeRequestDescriptor instead')
const ApproveCodeRequest$json = {
  '1': 'ApproveCodeRequest',
  '2': [
    {'1': 'code', '3': 1, '4': 1, '5': 9, '10': 'code'},
  ],
};

/// Descriptor for `ApproveCodeRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List approveCodeRequestDescriptor = $convert
    .base64Decode('ChJBcHByb3ZlQ29kZVJlcXVlc3QSEgoEY29kZRgBIAEoCVIEY29kZQ==');

@$core.Deprecated('Use approveCodeResponseDescriptor instead')
const ApproveCodeResponse$json = {
  '1': 'ApproveCodeResponse',
  '2': [
    {'1': 'device_name', '3': 1, '4': 1, '5': 9, '10': 'deviceName'},
  ],
};

/// Descriptor for `ApproveCodeResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List approveCodeResponseDescriptor = $convert.base64Decode(
    'ChNBcHByb3ZlQ29kZVJlc3BvbnNlEh8KC2RldmljZV9uYW1lGAEgASgJUgpkZXZpY2VOYW1l');

const $core.Map<$core.String, $core.dynamic> AuthServiceBase$json = {
  '1': 'AuthService',
  '2': [
    {
      '1': 'GetServerInfo',
      '2': '.kantahe.v1.GetServerInfoRequest',
      '3': '.kantahe.v1.GetServerInfoResponse'
    },
    {
      '1': 'Setup',
      '2': '.kantahe.v1.SetupRequest',
      '3': '.kantahe.v1.SetupResponse'
    },
    {
      '1': 'Login',
      '2': '.kantahe.v1.LoginRequest',
      '3': '.kantahe.v1.LoginResponse'
    },
    {
      '1': 'Logout',
      '2': '.kantahe.v1.LogoutRequest',
      '3': '.kantahe.v1.LogoutResponse'
    },
    {
      '1': 'ChangePassword',
      '2': '.kantahe.v1.ChangePasswordRequest',
      '3': '.kantahe.v1.ChangePasswordResponse'
    },
    {'1': 'Me', '2': '.kantahe.v1.MeRequest', '3': '.kantahe.v1.MeResponse'},
    {
      '1': 'ListMyDevices',
      '2': '.kantahe.v1.ListMyDevicesRequest',
      '3': '.kantahe.v1.ListMyDevicesResponse'
    },
    {
      '1': 'RevokeDevice',
      '2': '.kantahe.v1.RevokeDeviceRequest',
      '3': '.kantahe.v1.RevokeDeviceResponse'
    },
    {
      '1': 'StartCodeLogin',
      '2': '.kantahe.v1.StartCodeLoginRequest',
      '3': '.kantahe.v1.StartCodeLoginResponse'
    },
    {
      '1': 'WaitCodeLogin',
      '2': '.kantahe.v1.WaitCodeLoginRequest',
      '3': '.kantahe.v1.WaitCodeLoginResponse',
      '6': true
    },
    {
      '1': 'ApproveCode',
      '2': '.kantahe.v1.ApproveCodeRequest',
      '3': '.kantahe.v1.ApproveCodeResponse'
    },
  ],
};

@$core.Deprecated('Use authServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    AuthServiceBase$messageJson = {
  '.kantahe.v1.GetServerInfoRequest': GetServerInfoRequest$json,
  '.kantahe.v1.GetServerInfoResponse': GetServerInfoResponse$json,
  '.kantahe.v1.SetupRequest': SetupRequest$json,
  '.kantahe.v1.SetupResponse': SetupResponse$json,
  '.kantahe.v1.AuthToken': $0.AuthToken$json,
  '.kantahe.v1.User': $0.User$json,
  '.kantahe.v1.LoginRequest': LoginRequest$json,
  '.kantahe.v1.LoginResponse': LoginResponse$json,
  '.kantahe.v1.LogoutRequest': LogoutRequest$json,
  '.kantahe.v1.LogoutResponse': LogoutResponse$json,
  '.kantahe.v1.ChangePasswordRequest': ChangePasswordRequest$json,
  '.kantahe.v1.ChangePasswordResponse': ChangePasswordResponse$json,
  '.kantahe.v1.MeRequest': MeRequest$json,
  '.kantahe.v1.MeResponse': MeResponse$json,
  '.kantahe.v1.ListMyDevicesRequest': ListMyDevicesRequest$json,
  '.kantahe.v1.ListMyDevicesResponse': ListMyDevicesResponse$json,
  '.kantahe.v1.Device': $0.Device$json,
  '.kantahe.v1.RevokeDeviceRequest': RevokeDeviceRequest$json,
  '.kantahe.v1.RevokeDeviceResponse': RevokeDeviceResponse$json,
  '.kantahe.v1.StartCodeLoginRequest': StartCodeLoginRequest$json,
  '.kantahe.v1.StartCodeLoginResponse': StartCodeLoginResponse$json,
  '.kantahe.v1.WaitCodeLoginRequest': WaitCodeLoginRequest$json,
  '.kantahe.v1.WaitCodeLoginResponse': WaitCodeLoginResponse$json,
  '.kantahe.v1.ApproveCodeRequest': ApproveCodeRequest$json,
  '.kantahe.v1.ApproveCodeResponse': ApproveCodeResponse$json,
};

/// Descriptor for `AuthService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List authServiceDescriptor = $convert.base64Decode(
    'CgtBdXRoU2VydmljZRJUCg1HZXRTZXJ2ZXJJbmZvEiAua2FudGFoZS52MS5HZXRTZXJ2ZXJJbm'
    'ZvUmVxdWVzdBohLmthbnRhaGUudjEuR2V0U2VydmVySW5mb1Jlc3BvbnNlEjwKBVNldHVwEhgu'
    'a2FudGFoZS52MS5TZXR1cFJlcXVlc3QaGS5rYW50YWhlLnYxLlNldHVwUmVzcG9uc2USPAoFTG'
    '9naW4SGC5rYW50YWhlLnYxLkxvZ2luUmVxdWVzdBoZLmthbnRhaGUudjEuTG9naW5SZXNwb25z'
    'ZRI/CgZMb2dvdXQSGS5rYW50YWhlLnYxLkxvZ291dFJlcXVlc3QaGi5rYW50YWhlLnYxLkxvZ2'
    '91dFJlc3BvbnNlElcKDkNoYW5nZVBhc3N3b3JkEiEua2FudGFoZS52MS5DaGFuZ2VQYXNzd29y'
    'ZFJlcXVlc3QaIi5rYW50YWhlLnYxLkNoYW5nZVBhc3N3b3JkUmVzcG9uc2USMwoCTWUSFS5rYW'
    '50YWhlLnYxLk1lUmVxdWVzdBoWLmthbnRhaGUudjEuTWVSZXNwb25zZRJUCg1MaXN0TXlEZXZp'
    'Y2VzEiAua2FudGFoZS52MS5MaXN0TXlEZXZpY2VzUmVxdWVzdBohLmthbnRhaGUudjEuTGlzdE'
    '15RGV2aWNlc1Jlc3BvbnNlElEKDFJldm9rZURldmljZRIfLmthbnRhaGUudjEuUmV2b2tlRGV2'
    'aWNlUmVxdWVzdBogLmthbnRhaGUudjEuUmV2b2tlRGV2aWNlUmVzcG9uc2USVwoOU3RhcnRDb2'
    'RlTG9naW4SIS5rYW50YWhlLnYxLlN0YXJ0Q29kZUxvZ2luUmVxdWVzdBoiLmthbnRhaGUudjEu'
    'U3RhcnRDb2RlTG9naW5SZXNwb25zZRJWCg1XYWl0Q29kZUxvZ2luEiAua2FudGFoZS52MS5XYW'
    'l0Q29kZUxvZ2luUmVxdWVzdBohLmthbnRhaGUudjEuV2FpdENvZGVMb2dpblJlc3BvbnNlMAES'
    'TgoLQXBwcm92ZUNvZGUSHi5rYW50YWhlLnYxLkFwcHJvdmVDb2RlUmVxdWVzdBofLmthbnRhaG'
    'UudjEuQXBwcm92ZUNvZGVSZXNwb25zZQ==');
