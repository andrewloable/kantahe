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

@$core.Deprecated('Use beginVideoUploadRequestDescriptor instead')
const BeginVideoUploadRequest$json = {
  '1': 'BeginVideoUploadRequest',
  '2': [
    {'1': 'filename', '3': 1, '4': 1, '5': 9, '10': 'filename'},
    {'1': 'size_bytes', '3': 2, '4': 1, '5': 3, '10': 'sizeBytes'},
  ],
};

/// Descriptor for `BeginVideoUploadRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List beginVideoUploadRequestDescriptor =
    $convert.base64Decode(
        'ChdCZWdpblZpZGVvVXBsb2FkUmVxdWVzdBIaCghmaWxlbmFtZRgBIAEoCVIIZmlsZW5hbWUSHQ'
        'oKc2l6ZV9ieXRlcxgCIAEoA1IJc2l6ZUJ5dGVz');

@$core.Deprecated('Use beginVideoUploadResponseDescriptor instead')
const BeginVideoUploadResponse$json = {
  '1': 'BeginVideoUploadResponse',
  '2': [
    {'1': 'upload_id', '3': 1, '4': 1, '5': 9, '10': 'uploadId'},
    {'1': 'chunk_size', '3': 2, '4': 1, '5': 5, '10': 'chunkSize'},
    {'1': 'received', '3': 3, '4': 1, '5': 3, '10': 'received'},
    {
      '1': 'status',
      '3': 4,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.UploadStatus',
      '10': 'status'
    },
    {'1': 'reason', '3': 5, '4': 1, '5': 9, '10': 'reason'},
  ],
};

/// Descriptor for `BeginVideoUploadResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List beginVideoUploadResponseDescriptor = $convert.base64Decode(
    'ChhCZWdpblZpZGVvVXBsb2FkUmVzcG9uc2USGwoJdXBsb2FkX2lkGAEgASgJUgh1cGxvYWRJZB'
    'IdCgpjaHVua19zaXplGAIgASgFUgljaHVua1NpemUSGgoIcmVjZWl2ZWQYAyABKANSCHJlY2Vp'
    'dmVkEjAKBnN0YXR1cxgEIAEoDjIYLmthbnRhaGUudjEuVXBsb2FkU3RhdHVzUgZzdGF0dXMSFg'
    'oGcmVhc29uGAUgASgJUgZyZWFzb24=');

@$core.Deprecated('Use uploadVideoChunkRequestDescriptor instead')
const UploadVideoChunkRequest$json = {
  '1': 'UploadVideoChunkRequest',
  '2': [
    {'1': 'upload_id', '3': 1, '4': 1, '5': 9, '10': 'uploadId'},
    {'1': 'offset', '3': 2, '4': 1, '5': 3, '10': 'offset'},
    {'1': 'content', '3': 3, '4': 1, '5': 12, '10': 'content'},
  ],
};

/// Descriptor for `UploadVideoChunkRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List uploadVideoChunkRequestDescriptor =
    $convert.base64Decode(
        'ChdVcGxvYWRWaWRlb0NodW5rUmVxdWVzdBIbCgl1cGxvYWRfaWQYASABKAlSCHVwbG9hZElkEh'
        'YKBm9mZnNldBgCIAEoA1IGb2Zmc2V0EhgKB2NvbnRlbnQYAyABKAxSB2NvbnRlbnQ=');

@$core.Deprecated('Use uploadVideoChunkResponseDescriptor instead')
const UploadVideoChunkResponse$json = {
  '1': 'UploadVideoChunkResponse',
  '2': [
    {'1': 'received', '3': 1, '4': 1, '5': 3, '10': 'received'},
  ],
};

/// Descriptor for `UploadVideoChunkResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List uploadVideoChunkResponseDescriptor =
    $convert.base64Decode(
        'ChhVcGxvYWRWaWRlb0NodW5rUmVzcG9uc2USGgoIcmVjZWl2ZWQYASABKANSCHJlY2VpdmVk');

@$core.Deprecated('Use completeVideoUploadRequestDescriptor instead')
const CompleteVideoUploadRequest$json = {
  '1': 'CompleteVideoUploadRequest',
  '2': [
    {'1': 'upload_id', '3': 1, '4': 1, '5': 9, '10': 'uploadId'},
  ],
};

/// Descriptor for `CompleteVideoUploadRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List completeVideoUploadRequestDescriptor =
    $convert.base64Decode(
        'ChpDb21wbGV0ZVZpZGVvVXBsb2FkUmVxdWVzdBIbCgl1cGxvYWRfaWQYASABKAlSCHVwbG9hZE'
        'lk');

@$core.Deprecated('Use completeVideoUploadResponseDescriptor instead')
const CompleteVideoUploadResponse$json = {
  '1': 'CompleteVideoUploadResponse',
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
      '1': 'video',
      '3': 2,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Video',
      '10': 'video'
    },
    {'1': 'reason', '3': 3, '4': 1, '5': 9, '10': 'reason'},
  ],
};

/// Descriptor for `CompleteVideoUploadResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List completeVideoUploadResponseDescriptor =
    $convert.base64Decode(
        'ChtDb21wbGV0ZVZpZGVvVXBsb2FkUmVzcG9uc2USMAoGc3RhdHVzGAEgASgOMhgua2FudGFoZS'
        '52MS5VcGxvYWRTdGF0dXNSBnN0YXR1cxInCgV2aWRlbxgCIAEoCzIRLmthbnRhaGUudjEuVmlk'
        'ZW9SBXZpZGVvEhYKBnJlYXNvbhgDIAEoCVIGcmVhc29u');

@$core.Deprecated('Use abortVideoUploadRequestDescriptor instead')
const AbortVideoUploadRequest$json = {
  '1': 'AbortVideoUploadRequest',
  '2': [
    {'1': 'upload_id', '3': 1, '4': 1, '5': 9, '10': 'uploadId'},
  ],
};

/// Descriptor for `AbortVideoUploadRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List abortVideoUploadRequestDescriptor =
    $convert.base64Decode(
        'ChdBYm9ydFZpZGVvVXBsb2FkUmVxdWVzdBIbCgl1cGxvYWRfaWQYASABKAlSCHVwbG9hZElk');

@$core.Deprecated('Use abortVideoUploadResponseDescriptor instead')
const AbortVideoUploadResponse$json = {
  '1': 'AbortVideoUploadResponse',
};

/// Descriptor for `AbortVideoUploadResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List abortVideoUploadResponseDescriptor =
    $convert.base64Decode('ChhBYm9ydFZpZGVvVXBsb2FkUmVzcG9uc2U=');

const $core.Map<$core.String, $core.dynamic> UploadServiceBase$json = {
  '1': 'UploadService',
  '2': [
    {
      '1': 'UploadSong',
      '2': '.kantahe.v1.UploadSongRequest',
      '3': '.kantahe.v1.UploadSongResponse'
    },
    {
      '1': 'BeginVideoUpload',
      '2': '.kantahe.v1.BeginVideoUploadRequest',
      '3': '.kantahe.v1.BeginVideoUploadResponse'
    },
    {
      '1': 'UploadVideoChunk',
      '2': '.kantahe.v1.UploadVideoChunkRequest',
      '3': '.kantahe.v1.UploadVideoChunkResponse'
    },
    {
      '1': 'CompleteVideoUpload',
      '2': '.kantahe.v1.CompleteVideoUploadRequest',
      '3': '.kantahe.v1.CompleteVideoUploadResponse'
    },
    {
      '1': 'AbortVideoUpload',
      '2': '.kantahe.v1.AbortVideoUploadRequest',
      '3': '.kantahe.v1.AbortVideoUploadResponse'
    },
  ],
};

@$core.Deprecated('Use uploadServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    UploadServiceBase$messageJson = {
  '.kantahe.v1.UploadSongRequest': UploadSongRequest$json,
  '.kantahe.v1.UploadSongResponse': UploadSongResponse$json,
  '.kantahe.v1.Song': $0.Song$json,
  '.kantahe.v1.BeginVideoUploadRequest': BeginVideoUploadRequest$json,
  '.kantahe.v1.BeginVideoUploadResponse': BeginVideoUploadResponse$json,
  '.kantahe.v1.UploadVideoChunkRequest': UploadVideoChunkRequest$json,
  '.kantahe.v1.UploadVideoChunkResponse': UploadVideoChunkResponse$json,
  '.kantahe.v1.CompleteVideoUploadRequest': CompleteVideoUploadRequest$json,
  '.kantahe.v1.CompleteVideoUploadResponse': CompleteVideoUploadResponse$json,
  '.kantahe.v1.Video': $0.Video$json,
  '.kantahe.v1.AbortVideoUploadRequest': AbortVideoUploadRequest$json,
  '.kantahe.v1.AbortVideoUploadResponse': AbortVideoUploadResponse$json,
};

/// Descriptor for `UploadService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List uploadServiceDescriptor = $convert.base64Decode(
    'Cg1VcGxvYWRTZXJ2aWNlEksKClVwbG9hZFNvbmcSHS5rYW50YWhlLnYxLlVwbG9hZFNvbmdSZX'
    'F1ZXN0Gh4ua2FudGFoZS52MS5VcGxvYWRTb25nUmVzcG9uc2USXQoQQmVnaW5WaWRlb1VwbG9h'
    'ZBIjLmthbnRhaGUudjEuQmVnaW5WaWRlb1VwbG9hZFJlcXVlc3QaJC5rYW50YWhlLnYxLkJlZ2'
    'luVmlkZW9VcGxvYWRSZXNwb25zZRJdChBVcGxvYWRWaWRlb0NodW5rEiMua2FudGFoZS52MS5V'
    'cGxvYWRWaWRlb0NodW5rUmVxdWVzdBokLmthbnRhaGUudjEuVXBsb2FkVmlkZW9DaHVua1Jlc3'
    'BvbnNlEmYKE0NvbXBsZXRlVmlkZW9VcGxvYWQSJi5rYW50YWhlLnYxLkNvbXBsZXRlVmlkZW9V'
    'cGxvYWRSZXF1ZXN0Gicua2FudGFoZS52MS5Db21wbGV0ZVZpZGVvVXBsb2FkUmVzcG9uc2USXQ'
    'oQQWJvcnRWaWRlb1VwbG9hZBIjLmthbnRhaGUudjEuQWJvcnRWaWRlb1VwbG9hZFJlcXVlc3Qa'
    'JC5rYW50YWhlLnYxLkFib3J0VmlkZW9VcGxvYWRSZXNwb25zZQ==');
