// This is a generated file - do not edit.
//
// Generated from kantahe/v1/session.proto.

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

@$core.Deprecated('Use playStatusDescriptor instead')
const PlayStatus$json = {
  '1': 'PlayStatus',
  '2': [
    {'1': 'PLAY_STATUS_UNSPECIFIED', '2': 0},
    {'1': 'PLAY_STATUS_PAUSED', '2': 1},
    {'1': 'PLAY_STATUS_PLAYING', '2': 2},
  ],
};

/// Descriptor for `PlayStatus`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List playStatusDescriptor = $convert.base64Decode(
    'CgpQbGF5U3RhdHVzEhsKF1BMQVlfU1RBVFVTX1VOU1BFQ0lGSUVEEAASFgoSUExBWV9TVEFUVV'
    'NfUEFVU0VEEAESFwoTUExBWV9TVEFUVVNfUExBWUlORxAC');

@$core.Deprecated('Use songSourceDescriptor instead')
const SongSource$json = {
  '1': 'SongSource',
  '2': [
    {'1': 'SONG_SOURCE_UNSPECIFIED', '2': 0},
    {'1': 'SONG_SOURCE_QUEUE', '2': 1},
    {'1': 'SONG_SOURCE_RANDOM', '2': 2},
  ],
};

/// Descriptor for `SongSource`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List songSourceDescriptor = $convert.base64Decode(
    'CgpTb25nU291cmNlEhsKF1NPTkdfU09VUkNFX1VOU1BFQ0lGSUVEEAASFQoRU09OR19TT1VSQ0'
    'VfUVVFVUUQARIWChJTT05HX1NPVVJDRV9SQU5ET00QAg==');

@$core.Deprecated('Use scoreModeDescriptor instead')
const ScoreMode$json = {
  '1': 'ScoreMode',
  '2': [
    {'1': 'SCORE_MODE_UNSPECIFIED', '2': 0},
    {'1': 'SCORE_MODE_OFF', '2': 1},
    {'1': 'SCORE_MODE_RANDOM', '2': 2},
    {'1': 'SCORE_MODE_MICROPHONE', '2': 3},
  ],
};

/// Descriptor for `ScoreMode`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List scoreModeDescriptor = $convert.base64Decode(
    'CglTY29yZU1vZGUSGgoWU0NPUkVfTU9ERV9VTlNQRUNJRklFRBAAEhIKDlNDT1JFX01PREVfT0'
    'ZGEAESFQoRU0NPUkVfTU9ERV9SQU5ET00QAhIZChVTQ09SRV9NT0RFX01JQ1JPUEhPTkUQAw==');

@$core.Deprecated('Use scoreLevelDescriptor instead')
const ScoreLevel$json = {
  '1': 'ScoreLevel',
  '2': [
    {'1': 'SCORE_LEVEL_UNSPECIFIED', '2': 0},
    {'1': 'SCORE_LEVEL_LOW', '2': 1},
    {'1': 'SCORE_LEVEL_MIDDLE', '2': 2},
    {'1': 'SCORE_LEVEL_HIGH', '2': 3},
  ],
};

/// Descriptor for `ScoreLevel`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List scoreLevelDescriptor = $convert.base64Decode(
    'CgpTY29yZUxldmVsEhsKF1NDT1JFX0xFVkVMX1VOU1BFQ0lGSUVEEAASEwoPU0NPUkVfTEVWRU'
    'xfTE9XEAESFgoSU0NPUkVfTEVWRUxfTUlERExFEAISFAoQU0NPUkVfTEVWRUxfSElHSBAD');

@$core.Deprecated('Use controlActionDescriptor instead')
const ControlAction$json = {
  '1': 'ControlAction',
  '2': [
    {'1': 'CONTROL_ACTION_UNSPECIFIED', '2': 0},
    {'1': 'CONTROL_ACTION_PLAY', '2': 1},
    {'1': 'CONTROL_ACTION_PLAY_HERE', '2': 2},
    {'1': 'CONTROL_ACTION_PAUSE', '2': 3},
    {'1': 'CONTROL_ACTION_SKIP', '2': 4},
  ],
};

/// Descriptor for `ControlAction`. Decode as a `google.protobuf.EnumDescriptorProto`.
final $typed_data.Uint8List controlActionDescriptor = $convert.base64Decode(
    'Cg1Db250cm9sQWN0aW9uEh4KGkNPTlRST0xfQUNUSU9OX1VOU1BFQ0lGSUVEEAASFwoTQ09OVF'
    'JPTF9BQ1RJT05fUExBWRABEhwKGENPTlRST0xfQUNUSU9OX1BMQVlfSEVSRRACEhgKFENPTlRS'
    'T0xfQUNUSU9OX1BBVVNFEAMSFwoTQ09OVFJPTF9BQ1RJT05fU0tJUBAE');

@$core.Deprecated('Use watchStateRequestDescriptor instead')
const WatchStateRequest$json = {
  '1': 'WatchStateRequest',
};

/// Descriptor for `WatchStateRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List watchStateRequestDescriptor =
    $convert.base64Decode('ChFXYXRjaFN0YXRlUmVxdWVzdA==');

@$core.Deprecated('Use watchStateResponseDescriptor instead')
const WatchStateResponse$json = {
  '1': 'WatchStateResponse',
  '2': [
    {
      '1': 'state',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.State',
      '10': 'state'
    },
  ],
};

/// Descriptor for `WatchStateResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List watchStateResponseDescriptor = $convert.base64Decode(
    'ChJXYXRjaFN0YXRlUmVzcG9uc2USJwoFc3RhdGUYASABKAsyES5rYW50YWhlLnYxLlN0YXRlUg'
    'VzdGF0ZQ==');

@$core.Deprecated('Use getStateRequestDescriptor instead')
const GetStateRequest$json = {
  '1': 'GetStateRequest',
};

/// Descriptor for `GetStateRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getStateRequestDescriptor =
    $convert.base64Decode('Cg9HZXRTdGF0ZVJlcXVlc3Q=');

@$core.Deprecated('Use getStateResponseDescriptor instead')
const GetStateResponse$json = {
  '1': 'GetStateResponse',
  '2': [
    {
      '1': 'state',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.State',
      '10': 'state'
    },
  ],
};

/// Descriptor for `GetStateResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List getStateResponseDescriptor = $convert.base64Decode(
    'ChBHZXRTdGF0ZVJlc3BvbnNlEicKBXN0YXRlGAEgASgLMhEua2FudGFoZS52MS5TdGF0ZVIFc3'
    'RhdGU=');

@$core.Deprecated('Use addToQueueRequestDescriptor instead')
const AddToQueueRequest$json = {
  '1': 'AddToQueueRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
  ],
};

/// Descriptor for `AddToQueueRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List addToQueueRequestDescriptor = $convert.base64Decode(
    'ChFBZGRUb1F1ZXVlUmVxdWVzdBIWCgZudW1iZXIYASABKAlSBm51bWJlcg==');

@$core.Deprecated('Use addToQueueResponseDescriptor instead')
const AddToQueueResponse$json = {
  '1': 'AddToQueueResponse',
  '2': [
    {
      '1': 'item',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.QueueItem',
      '10': 'item'
    },
  ],
};

/// Descriptor for `AddToQueueResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List addToQueueResponseDescriptor = $convert.base64Decode(
    'ChJBZGRUb1F1ZXVlUmVzcG9uc2USKQoEaXRlbRgBIAEoCzIVLmthbnRhaGUudjEuUXVldWVJdG'
    'VtUgRpdGVt');

@$core.Deprecated('Use addPlaylistToQueueRequestDescriptor instead')
const AddPlaylistToQueueRequest$json = {
  '1': 'AddPlaylistToQueueRequest',
  '2': [
    {'1': 'playlist_id', '3': 1, '4': 1, '5': 9, '10': 'playlistId'},
  ],
};

/// Descriptor for `AddPlaylistToQueueRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List addPlaylistToQueueRequestDescriptor =
    $convert.base64Decode(
        'ChlBZGRQbGF5bGlzdFRvUXVldWVSZXF1ZXN0Eh8KC3BsYXlsaXN0X2lkGAEgASgJUgpwbGF5bG'
        'lzdElk');

@$core.Deprecated('Use addPlaylistToQueueResponseDescriptor instead')
const AddPlaylistToQueueResponse$json = {
  '1': 'AddPlaylistToQueueResponse',
  '2': [
    {'1': 'added', '3': 1, '4': 1, '5': 5, '10': 'added'},
  ],
};

/// Descriptor for `AddPlaylistToQueueResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List addPlaylistToQueueResponseDescriptor =
    $convert.base64Decode(
        'ChpBZGRQbGF5bGlzdFRvUXVldWVSZXNwb25zZRIUCgVhZGRlZBgBIAEoBVIFYWRkZWQ=');

@$core.Deprecated('Use removeFromQueueRequestDescriptor instead')
const RemoveFromQueueRequest$json = {
  '1': 'RemoveFromQueueRequest',
  '2': [
    {'1': 'item_id', '3': 1, '4': 1, '5': 9, '10': 'itemId'},
  ],
};

/// Descriptor for `RemoveFromQueueRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List removeFromQueueRequestDescriptor =
    $convert.base64Decode(
        'ChZSZW1vdmVGcm9tUXVldWVSZXF1ZXN0EhcKB2l0ZW1faWQYASABKAlSBml0ZW1JZA==');

@$core.Deprecated('Use removeFromQueueResponseDescriptor instead')
const RemoveFromQueueResponse$json = {
  '1': 'RemoveFromQueueResponse',
};

/// Descriptor for `RemoveFromQueueResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List removeFromQueueResponseDescriptor =
    $convert.base64Decode('ChdSZW1vdmVGcm9tUXVldWVSZXNwb25zZQ==');

@$core.Deprecated('Use moveToTopRequestDescriptor instead')
const MoveToTopRequest$json = {
  '1': 'MoveToTopRequest',
  '2': [
    {'1': 'item_id', '3': 1, '4': 1, '5': 9, '10': 'itemId'},
  ],
};

/// Descriptor for `MoveToTopRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List moveToTopRequestDescriptor = $convert.base64Decode(
    'ChBNb3ZlVG9Ub3BSZXF1ZXN0EhcKB2l0ZW1faWQYASABKAlSBml0ZW1JZA==');

@$core.Deprecated('Use moveToTopResponseDescriptor instead')
const MoveToTopResponse$json = {
  '1': 'MoveToTopResponse',
};

/// Descriptor for `MoveToTopResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List moveToTopResponseDescriptor =
    $convert.base64Decode('ChFNb3ZlVG9Ub3BSZXNwb25zZQ==');

@$core.Deprecated('Use controlRequestDescriptor instead')
const ControlRequest$json = {
  '1': 'ControlRequest',
  '2': [
    {
      '1': 'action',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.ControlAction',
      '10': 'action'
    },
  ],
};

/// Descriptor for `ControlRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List controlRequestDescriptor = $convert.base64Decode(
    'Cg5Db250cm9sUmVxdWVzdBIxCgZhY3Rpb24YASABKA4yGS5rYW50YWhlLnYxLkNvbnRyb2xBY3'
    'Rpb25SBmFjdGlvbg==');

@$core.Deprecated('Use controlResponseDescriptor instead')
const ControlResponse$json = {
  '1': 'ControlResponse',
};

/// Descriptor for `ControlResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List controlResponseDescriptor =
    $convert.base64Decode('Cg9Db250cm9sUmVzcG9uc2U=');

@$core.Deprecated('Use updateUserSettingsRequestDescriptor instead')
const UpdateUserSettingsRequest$json = {
  '1': 'UpdateUserSettingsRequest',
  '2': [
    {
      '1': 'score_mode',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.ScoreMode',
      '9': 0,
      '10': 'scoreMode',
      '17': true
    },
    {
      '1': 'score_level',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.ScoreLevel',
      '9': 1,
      '10': 'scoreLevel',
      '17': true
    },
  ],
  '8': [
    {'1': '_score_mode'},
    {'1': '_score_level'},
  ],
};

/// Descriptor for `UpdateUserSettingsRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateUserSettingsRequestDescriptor = $convert.base64Decode(
    'ChlVcGRhdGVVc2VyU2V0dGluZ3NSZXF1ZXN0EjkKCnNjb3JlX21vZGUYASABKA4yFS5rYW50YW'
    'hlLnYxLlNjb3JlTW9kZUgAUglzY29yZU1vZGWIAQESPAoLc2NvcmVfbGV2ZWwYAiABKA4yFi5r'
    'YW50YWhlLnYxLlNjb3JlTGV2ZWxIAVIKc2NvcmVMZXZlbIgBAUINCgtfc2NvcmVfbW9kZUIOCg'
    'xfc2NvcmVfbGV2ZWw=');

@$core.Deprecated('Use updateUserSettingsResponseDescriptor instead')
const UpdateUserSettingsResponse$json = {
  '1': 'UpdateUserSettingsResponse',
  '2': [
    {
      '1': 'settings',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.UserSettings',
      '10': 'settings'
    },
  ],
};

/// Descriptor for `UpdateUserSettingsResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List updateUserSettingsResponseDescriptor =
    $convert.base64Decode(
        'ChpVcGRhdGVVc2VyU2V0dGluZ3NSZXNwb25zZRI0CghzZXR0aW5ncxgBIAEoCzIYLmthbnRhaG'
        'UudjEuVXNlclNldHRpbmdzUghzZXR0aW5ncw==');

@$core.Deprecated('Use readyRequestDescriptor instead')
const ReadyRequest$json = {
  '1': 'ReadyRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
  ],
};

/// Descriptor for `ReadyRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List readyRequestDescriptor = $convert
    .base64Decode('CgxSZWFkeVJlcXVlc3QSFgoGbnVtYmVyGAEgASgJUgZudW1iZXI=');

@$core.Deprecated('Use readyResponseDescriptor instead')
const ReadyResponse$json = {
  '1': 'ReadyResponse',
};

/// Descriptor for `ReadyResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List readyResponseDescriptor =
    $convert.base64Decode('Cg1SZWFkeVJlc3BvbnNl');

@$core.Deprecated('Use reportPositionRequestDescriptor instead')
const ReportPositionRequest$json = {
  '1': 'ReportPositionRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'position_ms', '3': 2, '4': 1, '5': 3, '10': 'positionMs'},
  ],
};

/// Descriptor for `ReportPositionRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reportPositionRequestDescriptor = $convert.base64Decode(
    'ChVSZXBvcnRQb3NpdGlvblJlcXVlc3QSFgoGbnVtYmVyGAEgASgJUgZudW1iZXISHwoLcG9zaX'
    'Rpb25fbXMYAiABKANSCnBvc2l0aW9uTXM=');

@$core.Deprecated('Use reportPositionResponseDescriptor instead')
const ReportPositionResponse$json = {
  '1': 'ReportPositionResponse',
};

/// Descriptor for `ReportPositionResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reportPositionResponseDescriptor =
    $convert.base64Decode('ChZSZXBvcnRQb3NpdGlvblJlc3BvbnNl');

@$core.Deprecated('Use endedRequestDescriptor instead')
const EndedRequest$json = {
  '1': 'EndedRequest',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'loud_readings', '3': 2, '4': 1, '5': 5, '10': 'loudReadings'},
  ],
};

/// Descriptor for `EndedRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List endedRequestDescriptor = $convert.base64Decode(
    'CgxFbmRlZFJlcXVlc3QSFgoGbnVtYmVyGAEgASgJUgZudW1iZXISIwoNbG91ZF9yZWFkaW5ncx'
    'gCIAEoBVIMbG91ZFJlYWRpbmdz');

@$core.Deprecated('Use endedResponseDescriptor instead')
const EndedResponse$json = {
  '1': 'EndedResponse',
};

/// Descriptor for `EndedResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List endedResponseDescriptor =
    $convert.base64Decode('Cg1FbmRlZFJlc3BvbnNl');

@$core.Deprecated('Use reportMicRequestDescriptor instead')
const ReportMicRequest$json = {
  '1': 'ReportMicRequest',
  '2': [
    {'1': 'available', '3': 1, '4': 1, '5': 8, '10': 'available'},
  ],
};

/// Descriptor for `ReportMicRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reportMicRequestDescriptor = $convert.base64Decode(
    'ChBSZXBvcnRNaWNSZXF1ZXN0EhwKCWF2YWlsYWJsZRgBIAEoCFIJYXZhaWxhYmxl');

@$core.Deprecated('Use reportMicResponseDescriptor instead')
const ReportMicResponse$json = {
  '1': 'ReportMicResponse',
};

/// Descriptor for `ReportMicResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reportMicResponseDescriptor =
    $convert.base64Decode('ChFSZXBvcnRNaWNSZXNwb25zZQ==');

@$core.Deprecated('Use reportDeviceRequestDescriptor instead')
const ReportDeviceRequest$json = {
  '1': 'ReportDeviceRequest',
  '2': [
    {'1': 'memory_mb', '3': 1, '4': 1, '5': 5, '10': 'memoryMb'},
    {'1': 'dropouts', '3': 2, '4': 1, '5': 5, '10': 'dropouts'},
  ],
};

/// Descriptor for `ReportDeviceRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reportDeviceRequestDescriptor = $convert.base64Decode(
    'ChNSZXBvcnREZXZpY2VSZXF1ZXN0EhsKCW1lbW9yeV9tYhgBIAEoBVIIbWVtb3J5TWISGgoIZH'
    'JvcG91dHMYAiABKAVSCGRyb3BvdXRz');

@$core.Deprecated('Use reportDeviceResponseDescriptor instead')
const ReportDeviceResponse$json = {
  '1': 'ReportDeviceResponse',
  '2': [
    {
      '1': 'device',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Device',
      '10': 'device'
    },
  ],
};

/// Descriptor for `ReportDeviceResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List reportDeviceResponseDescriptor = $convert.base64Decode(
    'ChRSZXBvcnREZXZpY2VSZXNwb25zZRIqCgZkZXZpY2UYASABKAsyEi5rYW50YWhlLnYxLkRldm'
    'ljZVIGZGV2aWNl');

@$core.Deprecated('Use setMidiModeRequestDescriptor instead')
const SetMidiModeRequest$json = {
  '1': 'SetMidiModeRequest',
  '2': [
    {'1': 'device_id', '3': 1, '4': 1, '5': 9, '10': 'deviceId'},
    {
      '1': 'mode',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.MidiMode',
      '10': 'mode'
    },
  ],
};

/// Descriptor for `SetMidiModeRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setMidiModeRequestDescriptor = $convert.base64Decode(
    'ChJTZXRNaWRpTW9kZVJlcXVlc3QSGwoJZGV2aWNlX2lkGAEgASgJUghkZXZpY2VJZBIoCgRtb2'
    'RlGAIgASgOMhQua2FudGFoZS52MS5NaWRpTW9kZVIEbW9kZQ==');

@$core.Deprecated('Use setMidiModeResponseDescriptor instead')
const SetMidiModeResponse$json = {
  '1': 'SetMidiModeResponse',
  '2': [
    {
      '1': 'device',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Device',
      '10': 'device'
    },
  ],
};

/// Descriptor for `SetMidiModeResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setMidiModeResponseDescriptor = $convert.base64Decode(
    'ChNTZXRNaWRpTW9kZVJlc3BvbnNlEioKBmRldmljZRgBIAEoCzISLmthbnRhaGUudjEuRGV2aW'
    'NlUgZkZXZpY2U=');

@$core.Deprecated('Use setBackgroundModeRequestDescriptor instead')
const SetBackgroundModeRequest$json = {
  '1': 'SetBackgroundModeRequest',
  '2': [
    {'1': 'device_id', '3': 1, '4': 1, '5': 9, '10': 'deviceId'},
    {
      '1': 'mode',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.BackgroundMode',
      '10': 'mode'
    },
  ],
};

/// Descriptor for `SetBackgroundModeRequest`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setBackgroundModeRequestDescriptor =
    $convert.base64Decode(
        'ChhTZXRCYWNrZ3JvdW5kTW9kZVJlcXVlc3QSGwoJZGV2aWNlX2lkGAEgASgJUghkZXZpY2VJZB'
        'IuCgRtb2RlGAIgASgOMhoua2FudGFoZS52MS5CYWNrZ3JvdW5kTW9kZVIEbW9kZQ==');

@$core.Deprecated('Use setBackgroundModeResponseDescriptor instead')
const SetBackgroundModeResponse$json = {
  '1': 'SetBackgroundModeResponse',
  '2': [
    {
      '1': 'device',
      '3': 1,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Device',
      '10': 'device'
    },
  ],
};

/// Descriptor for `SetBackgroundModeResponse`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List setBackgroundModeResponseDescriptor =
    $convert.base64Decode(
        'ChlTZXRCYWNrZ3JvdW5kTW9kZVJlc3BvbnNlEioKBmRldmljZRgBIAEoCzISLmthbnRhaGUudj'
        'EuRGV2aWNlUgZkZXZpY2U=');

@$core.Deprecated('Use queueItemDescriptor instead')
const QueueItem$json = {
  '1': 'QueueItem',
  '2': [
    {'1': 'id', '3': 1, '4': 1, '5': 9, '10': 'id'},
    {
      '1': 'song',
      '3': 2,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Song',
      '10': 'song'
    },
  ],
};

/// Descriptor for `QueueItem`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List queueItemDescriptor = $convert.base64Decode(
    'CglRdWV1ZUl0ZW0SDgoCaWQYASABKAlSAmlkEiQKBHNvbmcYAiABKAsyEC5rYW50YWhlLnYxLl'
    'NvbmdSBHNvbmc=');

@$core.Deprecated('Use nowPlayingDescriptor instead')
const NowPlaying$json = {
  '1': 'NowPlaying',
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
      '1': 'source',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.SongSource',
      '10': 'source'
    },
    {'1': 'position_ms', '3': 3, '4': 1, '5': 3, '10': 'positionMs'},
    {'1': 'position_at_ms', '3': 4, '4': 1, '5': 3, '10': 'positionAtMs'},
  ],
};

/// Descriptor for `NowPlaying`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List nowPlayingDescriptor = $convert.base64Decode(
    'CgpOb3dQbGF5aW5nEiQKBHNvbmcYASABKAsyEC5rYW50YWhlLnYxLlNvbmdSBHNvbmcSLgoGc2'
    '91cmNlGAIgASgOMhYua2FudGFoZS52MS5Tb25nU291cmNlUgZzb3VyY2USHwoLcG9zaXRpb25f'
    'bXMYAyABKANSCnBvc2l0aW9uTXMSJAoOcG9zaXRpb25fYXRfbXMYBCABKANSDHBvc2l0aW9uQX'
    'RNcw==');

@$core.Deprecated('Use upNextDescriptor instead')
const UpNext$json = {
  '1': 'UpNext',
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
      '1': 'source',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.SongSource',
      '10': 'source'
    },
  ],
};

/// Descriptor for `UpNext`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List upNextDescriptor = $convert.base64Decode(
    'CgZVcE5leHQSJAoEc29uZxgBIAEoCzIQLmthbnRhaGUudjEuU29uZ1IEc29uZxIuCgZzb3VyY2'
    'UYAiABKA4yFi5rYW50YWhlLnYxLlNvbmdTb3VyY2VSBnNvdXJjZQ==');

@$core.Deprecated('Use userSettingsDescriptor instead')
const UserSettings$json = {
  '1': 'UserSettings',
  '2': [
    {
      '1': 'score_mode',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.ScoreMode',
      '10': 'scoreMode'
    },
    {
      '1': 'score_level',
      '3': 2,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.ScoreLevel',
      '10': 'scoreLevel'
    },
  ],
};

/// Descriptor for `UserSettings`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List userSettingsDescriptor = $convert.base64Decode(
    'CgxVc2VyU2V0dGluZ3MSNAoKc2NvcmVfbW9kZRgBIAEoDjIVLmthbnRhaGUudjEuU2NvcmVNb2'
    'RlUglzY29yZU1vZGUSNwoLc2NvcmVfbGV2ZWwYAiABKA4yFi5rYW50YWhlLnYxLlNjb3JlTGV2'
    'ZWxSCnNjb3JlTGV2ZWw=');

@$core.Deprecated('Use scoreDescriptor instead')
const Score$json = {
  '1': 'Score',
  '2': [
    {'1': 'number', '3': 1, '4': 1, '5': 9, '10': 'number'},
    {'1': 'has_value', '3': 2, '4': 1, '5': 8, '10': 'hasValue'},
    {'1': 'value', '3': 3, '4': 1, '5': 5, '10': 'value'},
    {'1': 'comment', '3': 4, '4': 1, '5': 9, '10': 'comment'},
    {'1': 'fanfare', '3': 5, '4': 1, '5': 5, '10': 'fanfare'},
    {'1': 'reason', '3': 6, '4': 1, '5': 9, '10': 'reason'},
    {'1': 'until_ms', '3': 7, '4': 1, '5': 3, '10': 'untilMs'},
  ],
};

/// Descriptor for `Score`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List scoreDescriptor = $convert.base64Decode(
    'CgVTY29yZRIWCgZudW1iZXIYASABKAlSBm51bWJlchIbCgloYXNfdmFsdWUYAiABKAhSCGhhc1'
    'ZhbHVlEhQKBXZhbHVlGAMgASgFUgV2YWx1ZRIYCgdjb21tZW50GAQgASgJUgdjb21tZW50EhgK'
    'B2ZhbmZhcmUYBSABKAVSB2ZhbmZhcmUSFgoGcmVhc29uGAYgASgJUgZyZWFzb24SGQoIdW50aW'
    'xfbXMYByABKANSB3VudGlsTXM=');

@$core.Deprecated('Use stateDescriptor instead')
const State$json = {
  '1': 'State',
  '2': [
    {
      '1': 'status',
      '3': 1,
      '4': 1,
      '5': 14,
      '6': '.kantahe.v1.PlayStatus',
      '10': 'status'
    },
    {'1': 'player_device_id', '3': 2, '4': 1, '5': 9, '10': 'playerDeviceId'},
    {
      '1': 'devices',
      '3': 3,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.Device',
      '10': 'devices'
    },
    {
      '1': 'now',
      '3': 4,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.NowPlaying',
      '10': 'now'
    },
    {
      '1': 'queue',
      '3': 5,
      '4': 3,
      '5': 11,
      '6': '.kantahe.v1.QueueItem',
      '10': 'queue'
    },
    {
      '1': 'up_next',
      '3': 6,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.UpNext',
      '10': 'upNext'
    },
    {
      '1': 'settings',
      '3': 7,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.UserSettings',
      '10': 'settings'
    },
    {
      '1': 'score',
      '3': 8,
      '4': 1,
      '5': 11,
      '6': '.kantahe.v1.Score',
      '10': 'score'
    },
    {'1': 'server_time_ms', '3': 9, '4': 1, '5': 3, '10': 'serverTimeMs'},
  ],
};

/// Descriptor for `State`. Decode as a `google.protobuf.DescriptorProto`.
final $typed_data.Uint8List stateDescriptor = $convert.base64Decode(
    'CgVTdGF0ZRIuCgZzdGF0dXMYASABKA4yFi5rYW50YWhlLnYxLlBsYXlTdGF0dXNSBnN0YXR1cx'
    'IoChBwbGF5ZXJfZGV2aWNlX2lkGAIgASgJUg5wbGF5ZXJEZXZpY2VJZBIsCgdkZXZpY2VzGAMg'
    'AygLMhIua2FudGFoZS52MS5EZXZpY2VSB2RldmljZXMSKAoDbm93GAQgASgLMhYua2FudGFoZS'
    '52MS5Ob3dQbGF5aW5nUgNub3cSKwoFcXVldWUYBSADKAsyFS5rYW50YWhlLnYxLlF1ZXVlSXRl'
    'bVIFcXVldWUSKwoHdXBfbmV4dBgGIAEoCzISLmthbnRhaGUudjEuVXBOZXh0UgZ1cE5leHQSNA'
    'oIc2V0dGluZ3MYByABKAsyGC5rYW50YWhlLnYxLlVzZXJTZXR0aW5nc1IIc2V0dGluZ3MSJwoF'
    'c2NvcmUYCCABKAsyES5rYW50YWhlLnYxLlNjb3JlUgVzY29yZRIkCg5zZXJ2ZXJfdGltZV9tcx'
    'gJIAEoA1IMc2VydmVyVGltZU1z');

const $core.Map<$core.String, $core.dynamic> SessionServiceBase$json = {
  '1': 'SessionService',
  '2': [
    {
      '1': 'WatchState',
      '2': '.kantahe.v1.WatchStateRequest',
      '3': '.kantahe.v1.WatchStateResponse',
      '6': true
    },
    {
      '1': 'GetState',
      '2': '.kantahe.v1.GetStateRequest',
      '3': '.kantahe.v1.GetStateResponse'
    },
    {
      '1': 'AddToQueue',
      '2': '.kantahe.v1.AddToQueueRequest',
      '3': '.kantahe.v1.AddToQueueResponse'
    },
    {
      '1': 'AddPlaylistToQueue',
      '2': '.kantahe.v1.AddPlaylistToQueueRequest',
      '3': '.kantahe.v1.AddPlaylistToQueueResponse'
    },
    {
      '1': 'RemoveFromQueue',
      '2': '.kantahe.v1.RemoveFromQueueRequest',
      '3': '.kantahe.v1.RemoveFromQueueResponse'
    },
    {
      '1': 'MoveToTop',
      '2': '.kantahe.v1.MoveToTopRequest',
      '3': '.kantahe.v1.MoveToTopResponse'
    },
    {
      '1': 'Control',
      '2': '.kantahe.v1.ControlRequest',
      '3': '.kantahe.v1.ControlResponse'
    },
    {
      '1': 'UpdateUserSettings',
      '2': '.kantahe.v1.UpdateUserSettingsRequest',
      '3': '.kantahe.v1.UpdateUserSettingsResponse'
    },
    {
      '1': 'Ready',
      '2': '.kantahe.v1.ReadyRequest',
      '3': '.kantahe.v1.ReadyResponse'
    },
    {
      '1': 'ReportPosition',
      '2': '.kantahe.v1.ReportPositionRequest',
      '3': '.kantahe.v1.ReportPositionResponse'
    },
    {
      '1': 'Ended',
      '2': '.kantahe.v1.EndedRequest',
      '3': '.kantahe.v1.EndedResponse'
    },
    {
      '1': 'ReportMic',
      '2': '.kantahe.v1.ReportMicRequest',
      '3': '.kantahe.v1.ReportMicResponse'
    },
    {
      '1': 'ReportDevice',
      '2': '.kantahe.v1.ReportDeviceRequest',
      '3': '.kantahe.v1.ReportDeviceResponse'
    },
    {
      '1': 'SetMidiMode',
      '2': '.kantahe.v1.SetMidiModeRequest',
      '3': '.kantahe.v1.SetMidiModeResponse'
    },
    {
      '1': 'SetBackgroundMode',
      '2': '.kantahe.v1.SetBackgroundModeRequest',
      '3': '.kantahe.v1.SetBackgroundModeResponse'
    },
  ],
};

@$core.Deprecated('Use sessionServiceDescriptor instead')
const $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
    SessionServiceBase$messageJson = {
  '.kantahe.v1.WatchStateRequest': WatchStateRequest$json,
  '.kantahe.v1.WatchStateResponse': WatchStateResponse$json,
  '.kantahe.v1.State': State$json,
  '.kantahe.v1.Device': $0.Device$json,
  '.kantahe.v1.NowPlaying': NowPlaying$json,
  '.kantahe.v1.Song': $0.Song$json,
  '.kantahe.v1.QueueItem': QueueItem$json,
  '.kantahe.v1.UpNext': UpNext$json,
  '.kantahe.v1.UserSettings': UserSettings$json,
  '.kantahe.v1.Score': Score$json,
  '.kantahe.v1.GetStateRequest': GetStateRequest$json,
  '.kantahe.v1.GetStateResponse': GetStateResponse$json,
  '.kantahe.v1.AddToQueueRequest': AddToQueueRequest$json,
  '.kantahe.v1.AddToQueueResponse': AddToQueueResponse$json,
  '.kantahe.v1.AddPlaylistToQueueRequest': AddPlaylistToQueueRequest$json,
  '.kantahe.v1.AddPlaylistToQueueResponse': AddPlaylistToQueueResponse$json,
  '.kantahe.v1.RemoveFromQueueRequest': RemoveFromQueueRequest$json,
  '.kantahe.v1.RemoveFromQueueResponse': RemoveFromQueueResponse$json,
  '.kantahe.v1.MoveToTopRequest': MoveToTopRequest$json,
  '.kantahe.v1.MoveToTopResponse': MoveToTopResponse$json,
  '.kantahe.v1.ControlRequest': ControlRequest$json,
  '.kantahe.v1.ControlResponse': ControlResponse$json,
  '.kantahe.v1.UpdateUserSettingsRequest': UpdateUserSettingsRequest$json,
  '.kantahe.v1.UpdateUserSettingsResponse': UpdateUserSettingsResponse$json,
  '.kantahe.v1.ReadyRequest': ReadyRequest$json,
  '.kantahe.v1.ReadyResponse': ReadyResponse$json,
  '.kantahe.v1.ReportPositionRequest': ReportPositionRequest$json,
  '.kantahe.v1.ReportPositionResponse': ReportPositionResponse$json,
  '.kantahe.v1.EndedRequest': EndedRequest$json,
  '.kantahe.v1.EndedResponse': EndedResponse$json,
  '.kantahe.v1.ReportMicRequest': ReportMicRequest$json,
  '.kantahe.v1.ReportMicResponse': ReportMicResponse$json,
  '.kantahe.v1.ReportDeviceRequest': ReportDeviceRequest$json,
  '.kantahe.v1.ReportDeviceResponse': ReportDeviceResponse$json,
  '.kantahe.v1.SetMidiModeRequest': SetMidiModeRequest$json,
  '.kantahe.v1.SetMidiModeResponse': SetMidiModeResponse$json,
  '.kantahe.v1.SetBackgroundModeRequest': SetBackgroundModeRequest$json,
  '.kantahe.v1.SetBackgroundModeResponse': SetBackgroundModeResponse$json,
};

/// Descriptor for `SessionService`. Decode as a `google.protobuf.ServiceDescriptorProto`.
final $typed_data.Uint8List sessionServiceDescriptor = $convert.base64Decode(
    'Cg5TZXNzaW9uU2VydmljZRJNCgpXYXRjaFN0YXRlEh0ua2FudGFoZS52MS5XYXRjaFN0YXRlUm'
    'VxdWVzdBoeLmthbnRhaGUudjEuV2F0Y2hTdGF0ZVJlc3BvbnNlMAESRQoIR2V0U3RhdGUSGy5r'
    'YW50YWhlLnYxLkdldFN0YXRlUmVxdWVzdBocLmthbnRhaGUudjEuR2V0U3RhdGVSZXNwb25zZR'
    'JLCgpBZGRUb1F1ZXVlEh0ua2FudGFoZS52MS5BZGRUb1F1ZXVlUmVxdWVzdBoeLmthbnRhaGUu'
    'djEuQWRkVG9RdWV1ZVJlc3BvbnNlEmMKEkFkZFBsYXlsaXN0VG9RdWV1ZRIlLmthbnRhaGUudj'
    'EuQWRkUGxheWxpc3RUb1F1ZXVlUmVxdWVzdBomLmthbnRhaGUudjEuQWRkUGxheWxpc3RUb1F1'
    'ZXVlUmVzcG9uc2USWgoPUmVtb3ZlRnJvbVF1ZXVlEiIua2FudGFoZS52MS5SZW1vdmVGcm9tUX'
    'VldWVSZXF1ZXN0GiMua2FudGFoZS52MS5SZW1vdmVGcm9tUXVldWVSZXNwb25zZRJICglNb3Zl'
    'VG9Ub3ASHC5rYW50YWhlLnYxLk1vdmVUb1RvcFJlcXVlc3QaHS5rYW50YWhlLnYxLk1vdmVUb1'
    'RvcFJlc3BvbnNlEkIKB0NvbnRyb2wSGi5rYW50YWhlLnYxLkNvbnRyb2xSZXF1ZXN0Ghsua2Fu'
    'dGFoZS52MS5Db250cm9sUmVzcG9uc2USYwoSVXBkYXRlVXNlclNldHRpbmdzEiUua2FudGFoZS'
    '52MS5VcGRhdGVVc2VyU2V0dGluZ3NSZXF1ZXN0GiYua2FudGFoZS52MS5VcGRhdGVVc2VyU2V0'
    'dGluZ3NSZXNwb25zZRI8CgVSZWFkeRIYLmthbnRhaGUudjEuUmVhZHlSZXF1ZXN0Ghkua2FudG'
    'FoZS52MS5SZWFkeVJlc3BvbnNlElcKDlJlcG9ydFBvc2l0aW9uEiEua2FudGFoZS52MS5SZXBv'
    'cnRQb3NpdGlvblJlcXVlc3QaIi5rYW50YWhlLnYxLlJlcG9ydFBvc2l0aW9uUmVzcG9uc2USPA'
    'oFRW5kZWQSGC5rYW50YWhlLnYxLkVuZGVkUmVxdWVzdBoZLmthbnRhaGUudjEuRW5kZWRSZXNw'
    'b25zZRJICglSZXBvcnRNaWMSHC5rYW50YWhlLnYxLlJlcG9ydE1pY1JlcXVlc3QaHS5rYW50YW'
    'hlLnYxLlJlcG9ydE1pY1Jlc3BvbnNlElEKDFJlcG9ydERldmljZRIfLmthbnRhaGUudjEuUmVw'
    'b3J0RGV2aWNlUmVxdWVzdBogLmthbnRhaGUudjEuUmVwb3J0RGV2aWNlUmVzcG9uc2USTgoLU2'
    'V0TWlkaU1vZGUSHi5rYW50YWhlLnYxLlNldE1pZGlNb2RlUmVxdWVzdBofLmthbnRhaGUudjEu'
    'U2V0TWlkaU1vZGVSZXNwb25zZRJgChFTZXRCYWNrZ3JvdW5kTW9kZRIkLmthbnRhaGUudjEuU2'
    'V0QmFja2dyb3VuZE1vZGVSZXF1ZXN0GiUua2FudGFoZS52MS5TZXRCYWNrZ3JvdW5kTW9kZVJl'
    'c3BvbnNl');
