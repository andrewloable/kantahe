// This is a generated file - do not edit.
//
// Generated from kantahe/v1/common.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

/// How a song entry is stored: an MP3 (from a .karmp3) or a MIDI file (.kar).
class Format extends $pb.ProtobufEnum {
  static const Format FORMAT_UNSPECIFIED =
      Format._(0, _omitEnumNames ? '' : 'FORMAT_UNSPECIFIED');
  static const Format FORMAT_MP3 =
      Format._(1, _omitEnumNames ? '' : 'FORMAT_MP3');
  static const Format FORMAT_MIDI =
      Format._(2, _omitEnumNames ? '' : 'FORMAT_MIDI');

  static const $core.List<Format> values = <Format>[
    FORMAT_UNSPECIFIED,
    FORMAT_MP3,
    FORMAT_MIDI,
  ];

  static final $core.List<Format?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 2);
  static Format? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const Format._(super.value, super.name);
}

/// Kind of client a device is; chosen by the client at sign-in and never trusted for permissions.
class DeviceType extends $pb.ProtobufEnum {
  static const DeviceType DEVICE_TYPE_UNSPECIFIED =
      DeviceType._(0, _omitEnumNames ? '' : 'DEVICE_TYPE_UNSPECIFIED');
  static const DeviceType DEVICE_TYPE_WEB =
      DeviceType._(1, _omitEnumNames ? '' : 'DEVICE_TYPE_WEB');
  static const DeviceType DEVICE_TYPE_ANDROID =
      DeviceType._(2, _omitEnumNames ? '' : 'DEVICE_TYPE_ANDROID');
  static const DeviceType DEVICE_TYPE_IOS =
      DeviceType._(3, _omitEnumNames ? '' : 'DEVICE_TYPE_IOS');
  static const DeviceType DEVICE_TYPE_ANDROID_TV =
      DeviceType._(4, _omitEnumNames ? '' : 'DEVICE_TYPE_ANDROID_TV');
  static const DeviceType DEVICE_TYPE_TIZEN =
      DeviceType._(5, _omitEnumNames ? '' : 'DEVICE_TYPE_TIZEN');
  static const DeviceType DEVICE_TYPE_WEBOS =
      DeviceType._(6, _omitEnumNames ? '' : 'DEVICE_TYPE_WEBOS');

  static const $core.List<DeviceType> values = <DeviceType>[
    DEVICE_TYPE_UNSPECIFIED,
    DEVICE_TYPE_WEB,
    DEVICE_TYPE_ANDROID,
    DEVICE_TYPE_IOS,
    DEVICE_TYPE_ANDROID_TV,
    DEVICE_TYPE_TIZEN,
    DEVICE_TYPE_WEBOS,
  ];

  static final $core.List<DeviceType?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 6);
  static DeviceType? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const DeviceType._(super.value, super.name);
}

/// Per-device MIDI synthesis choice (plan 4.1); AUTO lets the server decide from memory and dropouts.
class MidiMode extends $pb.ProtobufEnum {
  static const MidiMode MIDI_MODE_UNSPECIFIED =
      MidiMode._(0, _omitEnumNames ? '' : 'MIDI_MODE_UNSPECIFIED');
  static const MidiMode MIDI_MODE_AUTO =
      MidiMode._(1, _omitEnumNames ? '' : 'MIDI_MODE_AUTO');
  static const MidiMode MIDI_MODE_FULL =
      MidiMode._(2, _omitEnumNames ? '' : 'MIDI_MODE_FULL');
  static const MidiMode MIDI_MODE_LOW_POWER =
      MidiMode._(3, _omitEnumNames ? '' : 'MIDI_MODE_LOW_POWER');
  static const MidiMode MIDI_MODE_SERVER =
      MidiMode._(4, _omitEnumNames ? '' : 'MIDI_MODE_SERVER');

  static const $core.List<MidiMode> values = <MidiMode>[
    MIDI_MODE_UNSPECIFIED,
    MIDI_MODE_AUTO,
    MIDI_MODE_FULL,
    MIDI_MODE_LOW_POWER,
    MIDI_MODE_SERVER,
  ];

  static final $core.List<MidiMode?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 4);
  static MidiMode? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const MidiMode._(super.value, super.name);
}

/// Per-device background video choice (plan 4.2); AUTO lets the server decide: off for devices on the low-power or server MIDI mode or with little memory.
class BackgroundMode extends $pb.ProtobufEnum {
  static const BackgroundMode BACKGROUND_MODE_UNSPECIFIED =
      BackgroundMode._(0, _omitEnumNames ? '' : 'BACKGROUND_MODE_UNSPECIFIED');
  static const BackgroundMode BACKGROUND_MODE_AUTO =
      BackgroundMode._(1, _omitEnumNames ? '' : 'BACKGROUND_MODE_AUTO');
  static const BackgroundMode BACKGROUND_MODE_ON =
      BackgroundMode._(2, _omitEnumNames ? '' : 'BACKGROUND_MODE_ON');
  static const BackgroundMode BACKGROUND_MODE_OFF =
      BackgroundMode._(3, _omitEnumNames ? '' : 'BACKGROUND_MODE_OFF');

  static const $core.List<BackgroundMode> values = <BackgroundMode>[
    BACKGROUND_MODE_UNSPECIFIED,
    BACKGROUND_MODE_AUTO,
    BACKGROUND_MODE_ON,
    BACKGROUND_MODE_OFF,
  ];

  static final $core.List<BackgroundMode?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 3);
  static BackgroundMode? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const BackgroundMode._(super.value, super.name);
}

const $core.bool _omitEnumNames =
    $core.bool.fromEnvironment('protobuf.omit_enum_names');
