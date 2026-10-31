// This is a generated file - do not edit.
//
// Generated from kantahe/v1/upload.proto.

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

@$core.Deprecated('Use uploadStatusDescriptor instead')
const UploadStatus$json = {
  '1': 'UploadStatus',
  '2': [
    {'1': 'UPLOAD_STATUS_UNSPECIFIED', '2': 0},
    {'1': 'UPLOAD_STATUS_ADDED', '2': 1},
    {'1': 'UPLOAD_STATUS_DUPLICATE', '2': 2},
    {'1': 'UPLOAD_STATUS_REJECTED', '2': 3},
  ],
};

/// Descriptor for `UploadStatus`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List uploadStatusDescriptor = $convert.base64Decode(
    'CgxVcGxvYWRTdGF0dXMSHQoZVVBMT0FEX1NUQVRVU19VTlNQRUNJRklFRBAAEhcKE1VQTE9BRF'
    '9TVEFUVVNfQURERUQQARIbChdVUExPQURfU1RBVFVTX0RVUExJQ0FURRACEhoKFlVQTE9BRF9T'
    'VEFUVVNfUkVKRUNURUQQAw==');

@$core.Deprecated('Use uploadSongRequestDescriptor instead')
const UploadSongRequest$json = {
  '1': 'UploadSongRequest',
  '2': [
    {'1': 'filename', '3': 1, '4': 1, '5': 9, '10': 'filename'},
    {'1': 'content', '3': 2, '4': 1, '5': 12, '10': 'content'},
  ],
};

/// Descriptor for `UploadSongRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List uploadSongRequestDescriptor = $convert.base64Decode(
    'ChFVcGxvYWRTb25nUmVxdWVzdBIaCghmaWxlbmFtZRgBIAEoCVIIZmlsZW5hbWUSGAoHY29udG'
    'VudBgCIAEoDFIHY29udGVudA==');

@$core.Deprecated('Use uploadSongResponseDescriptor instead')
const UploadSongResponse$json = {
  '1': 'UploadSongResponse',
  '2': [
    {
      '1': 'status',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.UploadStatus',
      '10': 'status'
    },
    {
      '1': 'song',
      '3': 2,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'song'
    },
    {'1': 'reason', '3': 3, '4': 1, '5': 9, '10': 'reason'},
  ],
};

/// Descriptor for `UploadSongResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List uploadSongResponseDescriptor = $convert.base64Decode(
    'ChJVcGxvYWRTb25nUmVzcG9uc2USMAoGc3RhdHVzGAEgASgOMhgua2FudGFoZS52MS5VcGxvYW'
    'RTdGF0dXNSBnN0YXR1cxIkCgRzb25nGAIgASgLMhAua2FudGFoZS52MS5Tb25nUgRzb25nEhYK'
    'BnJlYXNvbhgDIAEoCVIGcmVhc29u');

const $core.Map<$core.String, $core.dynamic> UploadServiceBase$json = {
  '1': 'UploadService',
  '2': [
    {
      '1': 'UploadSong',
      '2': '.kantahe.v1.UploadSongRequest',
      '3': '.kantahe.v1.UploadSongResponse'
    },
  ],
};

@$core.Deprecated('Use uploadServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    UploadServiceBase$messageJson = {
  '.kantahe.v1.UploadSongRequest': UploadSongRequest$json,
  '.kantahe.v1.UploadSongResponse': UploadSongResponse$json,
  '.kantahe.v1.Song': $0.Song$json,
};

/// Descriptor for `UploadService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List uploadServiceDescriptor = $convert.base64Decode(
    'Cg1VcGxvYWRTZXJ2aWNlEksKClVwbG9hZFNvbmcSHS5rYW50YWhlLnYxLlVwbG9hZFNvbmdSZX'
    'F1ZXN0Gh4ua2FudGFoZS52MS5VcGxvYWRTb25nUmVzcG9uc2U=');
