// This is a generated file - do not edit.
//
// Generated from kantahe/v1/common.proto.

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

@$core.Deprecated('Use formatDescriptor instead')
const Format$json = {
  '1': 'Format',
  '2': [
    {'1': 'FORMAT_UNSPECIFIED', '2': 0},
    {'1': 'FORMAT_MP3', '2': 1},
    {'1': 'FORMAT_MIDI', '2': 2},
  ],
};

/// Descriptor for `Format`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List formatDescriptor = $convert.base64Decode(
    'CgZGb3JtYXQSFgoSRk9STUFUX1VOU1BFQ0lGSUVEEAASDgoKRk9STUFUX01QMxABEg8KC0ZPUk'
    '1BVF9NSURJEAI=');

@$core.Deprecated('Use deviceTypeDescriptor instead')
const DeviceType$json = {
  '1': 'DeviceType',
  '2': [
    {'1': 'DEVICE_TYPE_UNSPECIFIED', '2': 0},
    {'1': 'DEVICE_TYPE_WEB', '2': 1},
    {'1': 'DEVICE_TYPE_ANDROID', '2': 2},
    {'1': 'DEVICE_TYPE_IOS', '2': 3},
    {'1': 'DEVICE_TYPE_ANDROID_TV', '2': 4},
    {'1': 'DEVICE_TYPE_TIZEN', '2': 5},
    {'1': 'DEVICE_TYPE_WEBOS', '2': 6},
  ],
};

/// Descriptor for `DeviceType`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List deviceTypeDescriptor = $convert.base64Decode(
    'CgpEZXZpY2VUeXBlEhsKF0RFVklDRV9UWVBFX1VOU1BFQ0lGSUVEEAASEwoPREVWSUNFX1RZUE'
    'VfV0VCEAESFwoTREVWSUNFX1RZUEVfQU5EUk9JRBACEhMKD0RFVklDRV9UWVBFX0lPUxADEhoK'
    'FkRFVklDRV9UWVBFX0FORFJPSURfVFYQBBIVChFERVZJQ0VfVFlQRV9USVpFThAFEhUKEURFVk'
    'lDRV9UWVBFX1dFQk9TEAY=');

@$core.Deprecated('Use midiModeDescriptor instead')
const MidiMode$json = {
  '1': 'MidiMode',
  '2': [
    {'1': 'MIDI_MODE_UNSPECIFIED', '2': 0},
    {'1': 'MIDI_MODE_AUTO', '2': 1},
    {'1': 'MIDI_MODE_FULL', '2': 2},
    {'1': 'MIDI_MODE_LOW_POWER', '2': 3},
    {'1': 'MIDI_MODE_SERVER', '2': 4},
  ],
};

/// Descriptor for `MidiMode`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List midiModeDescriptor = $convert.base64Decode(
    'CghNaWRpTW9kZRIZChVNSURJX01PREVfVU5TUEVDSUZJRUQQABISCg5NSURJX01PREVfQVVUTx'
    'ABEhIKDk1JRElfTU9ERV9GVUxMEAISFwoTTUlESV9NT0RFX0xPV19QT1dFUhADEhQKEE1JRElf'
    'TU9ERV9TRVJWRVIQBA==');

@$core.Deprecated('Use songDescriptor instead')
const Song$json = {
  '1': 'Song',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {
      '1': 'format',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.Format',
      '10': 'format'
    },
    {'1': 'title', '3': 3, '4': 1, '5': 9, '10': 'title'},
    {'1': 'artist', '3': 4, '4': 1, '5': 9, '10': 'artist'},
    {'1': 'songbook_number', '3': 5, '4': 1, '5': 9, '10': 'songbookNumber'},
    {'1': 'duration_ms', '3': 6, '4': 1, '5': 3, '10': 'durationMs'},
    {'1': 'failed', '3': 7, '4': 1, '5': 8, '10': 'failed'},
    {'1': 'favourite', '3': 8, '4': 1, '5': 8, '10': 'favourite'},
  ],
};

/// Descriptor for `Song`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List songDescriptor = $convert.base64Decode(
    'CgRTb25nEhYKBm51bWJlchgBIAEoCVIGbnVtYmVyEioKBmZvcm1hdBgCIAEoDjISLmthbnRhaG'
    'UudjEuRm9ybWF0UgZmb3JtYXQSFAoFdGl0bGUYAyABKAlSBXRpdGxlEhYKBmFydGlzdBgEIAEo'
    'CVIGYXJ0aXN0EicKD3Nvbmdib29rX251bWJlchgFIAEoCVIOc29uZ2Jvb2tOdW1iZXISHwoLZH'
    'VyYXRpb25fbXMYBiABKANSCmR1cmF0aW9uTXMSFgoGZmFpbGVkGAcgASgIUgZmYWlsZWQSHAoJ'
    'ZmF2b3VyaXRlGAggASgIUglmYXZvdXJpdGU=');

@$core.Deprecated('Use lyricWordDescriptor instead')
const LyricWord$json = {
  '1': 'LyricWord',
  '2': [
    {'1': 'text', '3': 1, '4': 1, '5': 9, '10': 'text'},
    {'1': 'start_ms', '3': 2, '4': 1, '5': 3, '10': 'startMs'},
    {'1': 'end_ms', '3': 3, '4': 1, '5': 3, '10': 'endMs'},
  ],
};

/// Descriptor for `LyricWord`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List lyricWordDescriptor = $convert.base64Decode(
    'CglMeXJpY1dvcmQSEgoEdGV4dBgBIAEoCVIEdGV4dBIZCghzdGFydF9tcxgCIAEoA1IHc3Rhcn'
    'RNcxIVCgZlbmRfbXMYAyABKANSBWVuZE1z');

@$core.Deprecated('Use lyricLineDescriptor instead')
const LyricLine$json = {
  '1': 'LyricLine',
  '2': [
    {'1': 'start_ms', '3': 1, '4': 1, '5': 3, '10': 'startMs'},
    {'1': 'end_ms', '3': 2, '4': 1, '5': 3, '10': 'endMs'},
    {
      '1': 'words',
      '3': 3,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.LyricWord',
      '10': 'words'
    },
  ],
};

/// Descriptor for `LyricLine`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List lyricLineDescriptor = $convert.base64Decode(
    'CglMeXJpY0xpbmUSGQoIc3RhcnRfbXMYASABKANSB3N0YXJ0TXMSFQoGZW5kX21zGAIgASgDUg'
    'VlbmRNcxIrCgV3b3JkcxgDIAMoCzIVLmthbnRhaGUudjEuTHlyaWNXb3JkUgV3b3Jkcw==');

@$core.Deprecated('Use lyricsDescriptor instead')
const Lyrics$json = {
  '1': 'Lyrics',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'source', '3': 2, '4': 1, '5': 9, '10': 'source'},
    {'1': 'duration_ms', '3': 3, '4': 1, '5': 3, '10': 'durationMs'},
    {
      '1': 'lines',
      '3': 4,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.LyricLine',
      '10': 'lines'
    },
  ],
};

/// Descriptor for `Lyrics`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List lyricsDescriptor = $convert.base64Decode(
    'CgZMeXJpY3MSFgoGbnVtYmVyGAEgASgJUgZudW1iZXISFgoGc291cmNlGAIgASgJUgZzb3VyY2'
    'USHwoLZHVyYXRpb25fbXMYAyABKANSCmR1cmF0aW9uTXMSKwoFbGluZXMYBCADKAsyFS5rYW50'
    'YWhlLnYxLkx5cmljTGluZVIFbGluZXM=');

@$core.Deprecated('Use userDescriptor instead')
const User$json = {
  '1': 'User',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {'1': 'email', '3': 2, '4': 1, '5': 9, '10': 'email'},
    {'1': 'display_name', '3': 3, '4': 1, '5': 9, '10': 'displayName'},
    {'1': 'admin', '3': 4, '4': 1, '5': 8, '10': 'admin'},
    {'1': 'uploader', '3': 5, '4': 1, '5': 8, '10': 'uploader'},
    {
      '1': 'must_change_password',
      '3': 6,
      '4': 1,
      '5': 8,
      '10': 'mustChangePassword'
    },
    {'1': 'disabled', '3': 7, '4': 1, '5': 8, '10': 'disabled'},
  ],
};

/// Descriptor for `User`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List userDescriptor = $convert.base64Decode(
    'CgRVc2VyEg4KAmlkGAEgASgJUgJpZBIUCgVlbWFpbBgCIAEoCVIFZW1haWwSIQoMZGlzcGxheV'
    '9uYW1lGAMgASgJUgtkaXNwbGF5TmFtZRIUCgVhZG1pbhgEIAEoCFIFYWRtaW4SGgoIdXBsb2Fk'
    'ZXIYBSABKAhSCHVwbG9hZGVyEjAKFG11c3RfY2hhbmdlX3Bhc3N3b3JkGAYgASgIUhJtdXN0Q2'
    'hhbmdlUGFzc3dvcmQSGgoIZGlzYWJsZWQYByABKAhSCGRpc2FibGVk');

@$core.Deprecated('Use deviceDescriptor instead')
const Device$json = {
  '1': 'Device',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {'1': 'name', '3': 2, '4': 1, '5': 9, '10': 'name'},
    {
      '1': 'type',
      '3': 3,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.DeviceType',
      '10': 'type'
    },
    {'1': 'online', '3': 4, '4': 1, '5': 8, '10': 'online'},
    {'1': 'mic_available', '3': 5, '4': 1, '5': 8, '10': 'micAvailable'},
    {'1': 'memory_mb', '3': 6, '4': 1, '5': 5, '10': 'memoryMb'},
    {
      '1': 'midi_mode',
      '3': 7,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.MidiMode',
      '10': 'midiMode'
    },
    {
      '1': 'effective_midi_mode',
      '3': 8,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.MidiMode',
      '10': 'effectiveMidiMode'
    },
    {'1': 'is_caller', '3': 9, '4': 1, '5': 8, '10': 'isCaller'},
    {'1': 'last_seen_unix', '3': 10, '4': 1, '5': 3, '10': 'lastSeenUnix'},
  ],
};

/// Descriptor for `Device`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List deviceDescriptor = $convert.base64Decode(
    'CgZEZXZpY2USDgoCaWQYASABKAlSAmlkEhIKBG5hbWUYAiABKAlSBG5hbWUSKgoEdHlwZRgDIA'
    'EoDjIWLmthbnRhaGUudjEuRGV2aWNlVHlwZVIEdHlwZRIWCgZvbmxpbmUYBCABKAhSBm9ubGlu'
    'ZRIjCg1taWNfYXZhaWxhYmxlGAUgASgIUgxtaWNBdmFpbGFibGUSGwoJbWVtb3J5X21iGAYgAS'
    'gFUghtZW1vcnlNYhIxCgltaWRpX21vZGUYByABKA4yFC5rYW50YWhlLnYxLk1pZGlNb2RlUght'
    'aWRpTW9kZRJEChNlZmZlY3RpdmVfbWlkaV9tb2RlGAggASgOMhQua2FudGFoZS52MS5NaWRpTW'
    '9kZVIRZWZmZWN0aXZlTWlkaU1vZGUSGwoJaXNfY2FsbGVyGAkgASgIUghpc0NhbGxlchIkCg5s'
    'YXN0X3NlZW5fdW5peBgKIAEoA1IMbGFzdFNlZW5Vbml4');

@$core.Deprecated('Use authTokenDescriptor instead')
const AuthToken$json = {
  '1': 'AuthToken',
  '2': [
    {'1': 'token', '3': 1, '4': 1, '5': 9, '10': 'token'},
    {'1': 'device_id', '3': 2, '4': 1, '5': 9, '10': 'deviceId'},
    {
      '1': 'user',
      '3': 3,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.User',
      '10': 'user'
    },
  ],
};

/// Descriptor for `AuthToken`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List authTokenDescriptor = $convert.base64Decode(
    'CglBdXRoVG9rZW4SFAoFdG9rZW4YASABKAlSBXRva2VuEhsKCWRldmljZV9pZBgCIAEoCVIIZG'
    'V2aWNlSWQSJAoEdXNlchgDIAEoCzIQLmthbnRhaGUudjEuVXNlclIEdXNlcg==');
