// This is a generated file - do not edit.
//
// Generated from kantahe/v1/session.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

/// Whether the current song is playing or paused.
class PlayStatus extends $pb.ProtobufEnum {
  static const PlayStatus PLAY_STATUS_UNSPECIFIED =
      PlayStatus._(0, _omitEnumNames ? '' : 'PLAY_STATUS_UNSPECIFIED');
  static const PlayStatus PLAY_STATUS_PAUSED =
      PlayStatus._(1, _omitEnumNames ? '' : 'PLAY_STATUS_PAUSED');
  static const PlayStatus PLAY_STATUS_PLAYING =
      PlayStatus._(2, _omitEnumNames ? '' : 'PLAY_STATUS_PLAYING');

  static const $core.List<PlayStatus> values = <PlayStatus>[
    PLAY_STATUS_UNSPECIFIED,
    PLAY_STATUS_PAUSED,
    PLAY_STATUS_PLAYING,
  ];

  static final $core.List<PlayStatus?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 2);
  static PlayStatus? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const PlayStatus._(super.value, super.name);
}

/// Where the current or next song came from.
class SongSource extends $pb.ProtobufEnum {
  static const SongSource SONG_SOURCE_UNSPECIFIED =
      SongSource._(0, _omitEnumNames ? '' : 'SONG_SOURCE_UNSPECIFIED');
  static const SongSource SONG_SOURCE_QUEUE =
      SongSource._(1, _omitEnumNames ? '' : 'SONG_SOURCE_QUEUE');
  static const SongSource SONG_SOURCE_RANDOM =
      SongSource._(2, _omitEnumNames ? '' : 'SONG_SOURCE_RANDOM');

  static const $core.List<SongSource> values = <SongSource>[
    SONG_SOURCE_UNSPECIFIED,
    SONG_SOURCE_QUEUE,
    SONG_SOURCE_RANDOM,
  ];

  static final $core.List<SongSource?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 2);
  static SongSource? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const SongSource._(super.value, super.name);
}

/// How the end-of-song score is produced.
class ScoreMode extends $pb.ProtobufEnum {
  static const ScoreMode SCORE_MODE_UNSPECIFIED =
      ScoreMode._(0, _omitEnumNames ? '' : 'SCORE_MODE_UNSPECIFIED');
  static const ScoreMode SCORE_MODE_OFF =
      ScoreMode._(1, _omitEnumNames ? '' : 'SCORE_MODE_OFF');
  static const ScoreMode SCORE_MODE_RANDOM =
      ScoreMode._(2, _omitEnumNames ? '' : 'SCORE_MODE_RANDOM');
  static const ScoreMode SCORE_MODE_MICROPHONE =
      ScoreMode._(3, _omitEnumNames ? '' : 'SCORE_MODE_MICROPHONE');

  static const $core.List<ScoreMode> values = <ScoreMode>[
    SCORE_MODE_UNSPECIFIED,
    SCORE_MODE_OFF,
    SCORE_MODE_RANDOM,
    SCORE_MODE_MICROPHONE,
  ];

  static final $core.List<ScoreMode?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 3);
  static ScoreMode? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const ScoreMode._(super.value, super.name);
}

/// Difficulty of the score.
class ScoreLevel extends $pb.ProtobufEnum {
  static const ScoreLevel SCORE_LEVEL_UNSPECIFIED =
      ScoreLevel._(0, _omitEnumNames ? '' : 'SCORE_LEVEL_UNSPECIFIED');
  static const ScoreLevel SCORE_LEVEL_LOW =
      ScoreLevel._(1, _omitEnumNames ? '' : 'SCORE_LEVEL_LOW');
  static const ScoreLevel SCORE_LEVEL_MIDDLE =
      ScoreLevel._(2, _omitEnumNames ? '' : 'SCORE_LEVEL_MIDDLE');
  static const ScoreLevel SCORE_LEVEL_HIGH =
      ScoreLevel._(3, _omitEnumNames ? '' : 'SCORE_LEVEL_HIGH');

  static const $core.List<ScoreLevel> values = <ScoreLevel>[
    SCORE_LEVEL_UNSPECIFIED,
    SCORE_LEVEL_LOW,
    SCORE_LEVEL_MIDDLE,
    SCORE_LEVEL_HIGH,
  ];

  static final $core.List<ScoreLevel?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 3);
  static ScoreLevel? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const ScoreLevel._(super.value, super.name);
}

/// What a remote or player can ask the server to do.
class ControlAction extends $pb.ProtobufEnum {
  static const ControlAction CONTROL_ACTION_UNSPECIFIED =
      ControlAction._(0, _omitEnumNames ? '' : 'CONTROL_ACTION_UNSPECIFIED');
  static const ControlAction CONTROL_ACTION_PLAY =
      ControlAction._(1, _omitEnumNames ? '' : 'CONTROL_ACTION_PLAY');
  static const ControlAction CONTROL_ACTION_PLAY_HERE =
      ControlAction._(2, _omitEnumNames ? '' : 'CONTROL_ACTION_PLAY_HERE');
  static const ControlAction CONTROL_ACTION_PAUSE =
      ControlAction._(3, _omitEnumNames ? '' : 'CONTROL_ACTION_PAUSE');
  static const ControlAction CONTROL_ACTION_SKIP =
      ControlAction._(4, _omitEnumNames ? '' : 'CONTROL_ACTION_SKIP');

  static const $core.List<ControlAction> values = <ControlAction>[
    CONTROL_ACTION_UNSPECIFIED,
    CONTROL_ACTION_PLAY,
    CONTROL_ACTION_PLAY_HERE,
    CONTROL_ACTION_PAUSE,
    CONTROL_ACTION_SKIP,
  ];

  static final $core.List<ControlAction?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 4);
  static ControlAction? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const ControlAction._(super.value, super.name);
}

const $core.bool _omitEnumNames =
    $core.bool.fromEnvironment('protobuf.omit_enum_names');
