// This is a generated file - do not edit.
//
// Generated from kantahe/v1/catalog.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

/// Result order for SearchSongs.
class SongSort extends $pb.ProtobufEnum {
  /// Relevance when a query is given, number otherwise.
  static const SongSort SONG_SORT_UNSPECIFIED =
      SongSort._(0, _omitEnumNames ? '' : 'SONG_SORT_UNSPECIFIED');
  static const SongSort SONG_SORT_NUMBER =
      SongSort._(1, _omitEnumNames ? '' : 'SONG_SORT_NUMBER');
  static const SongSort SONG_SORT_TITLE =
      SongSort._(2, _omitEnumNames ? '' : 'SONG_SORT_TITLE');
  static const SongSort SONG_SORT_ARTIST =
      SongSort._(3, _omitEnumNames ? '' : 'SONG_SORT_ARTIST');

  static const $core.List<SongSort> values = <SongSort>[
    SONG_SORT_UNSPECIFIED,
    SONG_SORT_NUMBER,
    SONG_SORT_TITLE,
    SONG_SORT_ARTIST,
  ];

  static final $core.List<SongSort?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 3);
  static SongSort? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const SongSort._(super.value, super.name);
}

/// How a song is played on the calling device.
class PlaybackKind extends $pb.ProtobufEnum {
  static const PlaybackKind PLAYBACK_KIND_UNSPECIFIED =
      PlaybackKind._(0, _omitEnumNames ? '' : 'PLAYBACK_KIND_UNSPECIFIED');

  /// An audio file (an MP3 or the server-rendered MIDI audio) in audio_url.
  static const PlaybackKind PLAYBACK_KIND_AUDIO =
      PlaybackKind._(1, _omitEnumNames ? '' : 'PLAYBACK_KIND_AUDIO');

  /// MIDI synthesized on the client from midi_url and soundfont_url.
  static const PlaybackKind PLAYBACK_KIND_MIDI_SYNTH =
      PlaybackKind._(2, _omitEnumNames ? '' : 'PLAYBACK_KIND_MIDI_SYNTH');

  static const $core.List<PlaybackKind> values = <PlaybackKind>[
    PLAYBACK_KIND_UNSPECIFIED,
    PLAYBACK_KIND_AUDIO,
    PLAYBACK_KIND_MIDI_SYNTH,
  ];

  static final $core.List<PlaybackKind?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 2);
  static PlaybackKind? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const PlaybackKind._(super.value, super.name);
}

const $core.bool _omitEnumNames =
    $core.bool.fromEnvironment('protobuf.omit_enum_names');
