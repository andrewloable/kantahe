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

import 'package:fixnum/fixnum.dart' as $fixnum;
import 'package:protobuf/protobuf.dart' as $pb;

import 'common.pbenum.dart';

export 'package:protobuf/protobuf.dart' show GeneratedMessageGenericExtensions;

export 'common.pbenum.dart';

/// One library entry; number is unique and never changes (plan 6). Visible to every signed-in user.
class Song extends $pb.GeneratedMessage {
  factory Song({
    $core.String? number,
    Format? format,
    $core.String? title,
    $core.String? artist,
    $core.String? songbookNumber,
    $fixnum.Int64? durationMs,
    $core.bool? failed,
    $core.bool? favourite,
  }) {
    final result = Song._();
    if (number != null) result.number = number;
    if (format != null) result.format = format;
    if (title != null) result.title = title;
    if (artist != null) result.artist = artist;
    if (songbookNumber != null) result.songbookNumber = songbookNumber;
    if (durationMs != null) result.durationMs = durationMs;
    if (failed != null) result.failed = failed;
    if (favourite != null) result.favourite = favourite;
    return result;
  }

  Song._();

  factory Song.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Song()..mergeFromBuffer(data, registry);
  factory Song.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Song()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Song',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Song.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aE<Format>(2, _omitFieldNames ? '' : 'format', enumValues: Format.values)
    ..aOS(3, _omitFieldNames ? '' : 'title')
    ..aOS(4, _omitFieldNames ? '' : 'artist')
    ..aOS(5, _omitFieldNames ? '' : 'songbookNumber')
    ..aInt64(6, _omitFieldNames ? '' : 'durationMs')
    ..aOB(7, _omitFieldNames ? '' : 'failed')
    ..aOB(8, _omitFieldNames ? '' : 'favourite')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Song clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Song copyWith(void Function(Song) updates) =>
      super.copyWith((message) => updates(message as Song)) as Song;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Song() / Song.new instead')
  static Song create() => Song._();
  static $pb.GeneratedMessage $_createMessage() => Song._();
  @$core.override
  Song createEmptyInstance() => Song._();
  @$core.pragma('dart2js:noInline')
  static Song getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Song>(Song.$_createMessage);
  static Song? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  Format get format => $_getN(1);
  @$pb.TagNumber(2)
  set format(Format value) => $_setField(2, value);
  @$pb.TagNumber(2)
  $core.bool hasFormat() => $_has(1);
  @$pb.TagNumber(2)
  void clearFormat() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get title => $_getSZ(2);
  @$pb.TagNumber(3)
  set title($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasTitle() => $_has(2);
  @$pb.TagNumber(3)
  void clearTitle() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.String get artist => $_getSZ(3);
  @$pb.TagNumber(4)
  set artist($core.String value) => $_setString(3, value);
  @$pb.TagNumber(4)
  $core.bool hasArtist() => $_has(3);
  @$pb.TagNumber(4)
  void clearArtist() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.String get songbookNumber => $_getSZ(4);
  @$pb.TagNumber(5)
  set songbookNumber($core.String value) => $_setString(4, value);
  @$pb.TagNumber(5)
  $core.bool hasSongbookNumber() => $_has(4);
  @$pb.TagNumber(5)
  void clearSongbookNumber() => $_clearField(5);

  @$pb.TagNumber(6)
  $fixnum.Int64 get durationMs => $_getI64(5);
  @$pb.TagNumber(6)
  set durationMs($fixnum.Int64 value) => $_setInt64(5, value);
  @$pb.TagNumber(6)
  $core.bool hasDurationMs() => $_has(5);
  @$pb.TagNumber(6)
  void clearDurationMs() => $_clearField(6);

  /// True when the file could not be read; such songs are excluded from random fill.
  @$pb.TagNumber(7)
  $core.bool get failed => $_getBF(6);
  @$pb.TagNumber(7)
  set failed($core.bool value) => $_setBool(6, value);
  @$pb.TagNumber(7)
  $core.bool hasFailed() => $_has(6);
  @$pb.TagNumber(7)
  void clearFailed() => $_clearField(7);

  /// Whether the calling user has favourited it; always scoped to the caller.
  @$pb.TagNumber(8)
  $core.bool get favourite => $_getBF(7);
  @$pb.TagNumber(8)
  set favourite($core.bool value) => $_setBool(7, value);
  @$pb.TagNumber(8)
  $core.bool hasFavourite() => $_has(7);
  @$pb.TagNumber(8)
  void clearFavourite() => $_clearField(8);
}

/// One lyric word with its wipe window in milliseconds (plan 3).
class LyricWord extends $pb.GeneratedMessage {
  factory LyricWord({
    $core.String? text,
    $fixnum.Int64? startMs,
    $fixnum.Int64? endMs,
  }) {
    final result = LyricWord._();
    if (text != null) result.text = text;
    if (startMs != null) result.startMs = startMs;
    if (endMs != null) result.endMs = endMs;
    return result;
  }

  LyricWord._();

  factory LyricWord.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LyricWord()..mergeFromBuffer(data, registry);
  factory LyricWord.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LyricWord()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'LyricWord',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: LyricWord.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'text')
    ..aInt64(2, _omitFieldNames ? '' : 'startMs')
    ..aInt64(3, _omitFieldNames ? '' : 'endMs')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LyricWord clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LyricWord copyWith(void Function(LyricWord) updates) =>
      super.copyWith((message) => updates(message as LyricWord)) as LyricWord;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use LyricWord() / LyricWord.new instead')
  static LyricWord create() => LyricWord._();
  static $pb.GeneratedMessage $_createMessage() => LyricWord._();
  @$core.override
  LyricWord createEmptyInstance() => LyricWord._();
  @$core.pragma('dart2js:noInline')
  static LyricWord getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<LyricWord>(LyricWord.$_createMessage);
  static LyricWord? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get text => $_getSZ(0);
  @$pb.TagNumber(1)
  set text($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasText() => $_has(0);
  @$pb.TagNumber(1)
  void clearText() => $_clearField(1);

  @$pb.TagNumber(2)
  $fixnum.Int64 get startMs => $_getI64(1);
  @$pb.TagNumber(2)
  set startMs($fixnum.Int64 value) => $_setInt64(1, value);
  @$pb.TagNumber(2)
  $core.bool hasStartMs() => $_has(1);
  @$pb.TagNumber(2)
  void clearStartMs() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get endMs => $_getI64(2);
  @$pb.TagNumber(3)
  set endMs($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasEndMs() => $_has(2);
  @$pb.TagNumber(3)
  void clearEndMs() => $_clearField(3);
}

/// One displayed line; words are in order and never overlap.
class LyricLine extends $pb.GeneratedMessage {
  factory LyricLine({
    $fixnum.Int64? startMs,
    $fixnum.Int64? endMs,
    $core.Iterable<LyricWord>? words,
  }) {
    final result = LyricLine._();
    if (startMs != null) result.startMs = startMs;
    if (endMs != null) result.endMs = endMs;
    if (words != null) result.words.addAll(words);
    return result;
  }

  LyricLine._();

  factory LyricLine.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LyricLine()..mergeFromBuffer(data, registry);
  factory LyricLine.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      LyricLine()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'LyricLine',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: LyricLine.$_createMessage)
    ..aInt64(1, _omitFieldNames ? '' : 'startMs')
    ..aInt64(2, _omitFieldNames ? '' : 'endMs')
    ..pPM<LyricWord>(3, _omitFieldNames ? '' : 'words',
        subBuilder: LyricWord.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LyricLine clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  LyricLine copyWith(void Function(LyricLine) updates) =>
      super.copyWith((message) => updates(message as LyricLine)) as LyricLine;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use LyricLine() / LyricLine.new instead')
  static LyricLine create() => LyricLine._();
  static $pb.GeneratedMessage $_createMessage() => LyricLine._();
  @$core.override
  LyricLine createEmptyInstance() => LyricLine._();
  @$core.pragma('dart2js:noInline')
  static LyricLine getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<LyricLine>(LyricLine.$_createMessage);
  static LyricLine? _defaultInstance;

  @$pb.TagNumber(1)
  $fixnum.Int64 get startMs => $_getI64(0);
  @$pb.TagNumber(1)
  set startMs($fixnum.Int64 value) => $_setInt64(0, value);
  @$pb.TagNumber(1)
  $core.bool hasStartMs() => $_has(0);
  @$pb.TagNumber(1)
  void clearStartMs() => $_clearField(1);

  @$pb.TagNumber(2)
  $fixnum.Int64 get endMs => $_getI64(1);
  @$pb.TagNumber(2)
  set endMs($fixnum.Int64 value) => $_setInt64(1, value);
  @$pb.TagNumber(2)
  $core.bool hasEndMs() => $_has(1);
  @$pb.TagNumber(2)
  void clearEndMs() => $_clearField(2);

  @$pb.TagNumber(3)
  $pb.PbList<LyricWord> get words => $_getList(2);
}

/// All lyrics of a song, parsed by the server (D1); source is "lrc" or "kar".
class Lyrics extends $pb.GeneratedMessage {
  factory Lyrics({
    $core.String? number,
    $core.String? source,
    $fixnum.Int64? durationMs,
    $core.Iterable<LyricLine>? lines,
  }) {
    final result = Lyrics._();
    if (number != null) result.number = number;
    if (source != null) result.source = source;
    if (durationMs != null) result.durationMs = durationMs;
    if (lines != null) result.lines.addAll(lines);
    return result;
  }

  Lyrics._();

  factory Lyrics.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Lyrics()..mergeFromBuffer(data, registry);
  factory Lyrics.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Lyrics()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Lyrics',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Lyrics.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'number')
    ..aOS(2, _omitFieldNames ? '' : 'source')
    ..aInt64(3, _omitFieldNames ? '' : 'durationMs')
    ..pPM<LyricLine>(4, _omitFieldNames ? '' : 'lines',
        subBuilder: LyricLine.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Lyrics clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Lyrics copyWith(void Function(Lyrics) updates) =>
      super.copyWith((message) => updates(message as Lyrics)) as Lyrics;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Lyrics() / Lyrics.new instead')
  static Lyrics create() => Lyrics._();
  static $pb.GeneratedMessage $_createMessage() => Lyrics._();
  @$core.override
  Lyrics createEmptyInstance() => Lyrics._();
  @$core.pragma('dart2js:noInline')
  static Lyrics getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Lyrics>(Lyrics.$_createMessage);
  static Lyrics? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get number => $_getSZ(0);
  @$pb.TagNumber(1)
  set number($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasNumber() => $_has(0);
  @$pb.TagNumber(1)
  void clearNumber() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get source => $_getSZ(1);
  @$pb.TagNumber(2)
  set source($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasSource() => $_has(1);
  @$pb.TagNumber(2)
  void clearSource() => $_clearField(2);

  @$pb.TagNumber(3)
  $fixnum.Int64 get durationMs => $_getI64(2);
  @$pb.TagNumber(3)
  set durationMs($fixnum.Int64 value) => $_setInt64(2, value);
  @$pb.TagNumber(3)
  $core.bool hasDurationMs() => $_has(2);
  @$pb.TagNumber(3)
  void clearDurationMs() => $_clearField(3);

  @$pb.TagNumber(4)
  $pb.PbList<LyricLine> get lines => $_getList(3);
}

/// An account; password data is never sent. Only admins see other users.
class User extends $pb.GeneratedMessage {
  factory User({
    $core.String? id,
    $core.String? email,
    $core.String? displayName,
    $core.bool? admin,
    $core.bool? uploader,
    $core.bool? mustChangePassword,
    $core.bool? disabled,
  }) {
    final result = User._();
    if (id != null) result.id = id;
    if (email != null) result.email = email;
    if (displayName != null) result.displayName = displayName;
    if (admin != null) result.admin = admin;
    if (uploader != null) result.uploader = uploader;
    if (mustChangePassword != null)
      result.mustChangePassword = mustChangePassword;
    if (disabled != null) result.disabled = disabled;
    return result;
  }

  User._();

  factory User.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      User()..mergeFromBuffer(data, registry);
  factory User.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      User()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'User',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: User.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOS(2, _omitFieldNames ? '' : 'email')
    ..aOS(3, _omitFieldNames ? '' : 'displayName')
    ..aOB(4, _omitFieldNames ? '' : 'admin')
    ..aOB(5, _omitFieldNames ? '' : 'uploader')
    ..aOB(6, _omitFieldNames ? '' : 'mustChangePassword')
    ..aOB(7, _omitFieldNames ? '' : 'disabled')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  User clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  User copyWith(void Function(User) updates) =>
      super.copyWith((message) => updates(message as User)) as User;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use User() / User.new instead')
  static User create() => User._();
  static $pb.GeneratedMessage $_createMessage() => User._();
  @$core.override
  User createEmptyInstance() => User._();
  @$core.pragma('dart2js:noInline')
  static User getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<User>(User.$_createMessage);
  static User? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get email => $_getSZ(1);
  @$pb.TagNumber(2)
  set email($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasEmail() => $_has(1);
  @$pb.TagNumber(2)
  void clearEmail() => $_clearField(2);

  @$pb.TagNumber(3)
  $core.String get displayName => $_getSZ(2);
  @$pb.TagNumber(3)
  set displayName($core.String value) => $_setString(2, value);
  @$pb.TagNumber(3)
  $core.bool hasDisplayName() => $_has(2);
  @$pb.TagNumber(3)
  void clearDisplayName() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get admin => $_getBF(3);
  @$pb.TagNumber(4)
  set admin($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasAdmin() => $_has(3);
  @$pb.TagNumber(4)
  void clearAdmin() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get uploader => $_getBF(4);
  @$pb.TagNumber(5)
  set uploader($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasUploader() => $_has(4);
  @$pb.TagNumber(5)
  void clearUploader() => $_clearField(5);

  @$pb.TagNumber(6)
  $core.bool get mustChangePassword => $_getBF(5);
  @$pb.TagNumber(6)
  set mustChangePassword($core.bool value) => $_setBool(5, value);
  @$pb.TagNumber(6)
  $core.bool hasMustChangePassword() => $_has(5);
  @$pb.TagNumber(6)
  void clearMustChangePassword() => $_clearField(6);

  @$pb.TagNumber(7)
  $core.bool get disabled => $_getBF(6);
  @$pb.TagNumber(7)
  set disabled($core.bool value) => $_setBool(6, value);
  @$pb.TagNumber(7)
  $core.bool hasDisabled() => $_has(6);
  @$pb.TagNumber(7)
  void clearDisabled() => $_clearField(7);
}

/// A signed-in device of one user; is_caller marks the device making the request.
class Device extends $pb.GeneratedMessage {
  factory Device({
    $core.String? id,
    $core.String? name,
    DeviceType? type,
    $core.bool? online,
    $core.bool? micAvailable,
    $core.int? memoryMb,
    MidiMode? midiMode,
    MidiMode? effectiveMidiMode,
    $core.bool? isCaller,
    $fixnum.Int64? lastSeenUnix,
  }) {
    final result = Device._();
    if (id != null) result.id = id;
    if (name != null) result.name = name;
    if (type != null) result.type = type;
    if (online != null) result.online = online;
    if (micAvailable != null) result.micAvailable = micAvailable;
    if (memoryMb != null) result.memoryMb = memoryMb;
    if (midiMode != null) result.midiMode = midiMode;
    if (effectiveMidiMode != null) result.effectiveMidiMode = effectiveMidiMode;
    if (isCaller != null) result.isCaller = isCaller;
    if (lastSeenUnix != null) result.lastSeenUnix = lastSeenUnix;
    return result;
  }

  Device._();

  factory Device.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Device()..mergeFromBuffer(data, registry);
  factory Device.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      Device()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'Device',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: Device.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'id')
    ..aOS(2, _omitFieldNames ? '' : 'name')
    ..aE<DeviceType>(3, _omitFieldNames ? '' : 'type',
        enumValues: DeviceType.values)
    ..aOB(4, _omitFieldNames ? '' : 'online')
    ..aOB(5, _omitFieldNames ? '' : 'micAvailable')
    ..aI(6, _omitFieldNames ? '' : 'memoryMb')
    ..aE<MidiMode>(7, _omitFieldNames ? '' : 'midiMode',
        enumValues: MidiMode.values)
    ..aE<MidiMode>(8, _omitFieldNames ? '' : 'effectiveMidiMode',
        enumValues: MidiMode.values)
    ..aOB(9, _omitFieldNames ? '' : 'isCaller')
    ..aInt64(10, _omitFieldNames ? '' : 'lastSeenUnix')
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Device clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  Device copyWith(void Function(Device) updates) =>
      super.copyWith((message) => updates(message as Device)) as Device;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use Device() / Device.new instead')
  static Device create() => Device._();
  static $pb.GeneratedMessage $_createMessage() => Device._();
  @$core.override
  Device createEmptyInstance() => Device._();
  @$core.pragma('dart2js:noInline')
  static Device getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<Device>(Device.$_createMessage);
  static Device? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get id => $_getSZ(0);
  @$pb.TagNumber(1)
  set id($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasId() => $_has(0);
  @$pb.TagNumber(1)
  void clearId() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get name => $_getSZ(1);
  @$pb.TagNumber(2)
  set name($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasName() => $_has(1);
  @$pb.TagNumber(2)
  void clearName() => $_clearField(2);

  @$pb.TagNumber(3)
  DeviceType get type => $_getN(2);
  @$pb.TagNumber(3)
  set type(DeviceType value) => $_setField(3, value);
  @$pb.TagNumber(3)
  $core.bool hasType() => $_has(2);
  @$pb.TagNumber(3)
  void clearType() => $_clearField(3);

  @$pb.TagNumber(4)
  $core.bool get online => $_getBF(3);
  @$pb.TagNumber(4)
  set online($core.bool value) => $_setBool(3, value);
  @$pb.TagNumber(4)
  $core.bool hasOnline() => $_has(3);
  @$pb.TagNumber(4)
  void clearOnline() => $_clearField(4);

  @$pb.TagNumber(5)
  $core.bool get micAvailable => $_getBF(4);
  @$pb.TagNumber(5)
  set micAvailable($core.bool value) => $_setBool(4, value);
  @$pb.TagNumber(5)
  $core.bool hasMicAvailable() => $_has(4);
  @$pb.TagNumber(5)
  void clearMicAvailable() => $_clearField(5);

  @$pb.TagNumber(6)
  $core.int get memoryMb => $_getIZ(5);
  @$pb.TagNumber(6)
  set memoryMb($core.int value) => $_setSignedInt32(5, value);
  @$pb.TagNumber(6)
  $core.bool hasMemoryMb() => $_has(5);
  @$pb.TagNumber(6)
  void clearMemoryMb() => $_clearField(6);

  /// What the user chose; effective_midi_mode is what the server resolved from it.
  @$pb.TagNumber(7)
  MidiMode get midiMode => $_getN(6);
  @$pb.TagNumber(7)
  set midiMode(MidiMode value) => $_setField(7, value);
  @$pb.TagNumber(7)
  $core.bool hasMidiMode() => $_has(6);
  @$pb.TagNumber(7)
  void clearMidiMode() => $_clearField(7);

  @$pb.TagNumber(8)
  MidiMode get effectiveMidiMode => $_getN(7);
  @$pb.TagNumber(8)
  set effectiveMidiMode(MidiMode value) => $_setField(8, value);
  @$pb.TagNumber(8)
  $core.bool hasEffectiveMidiMode() => $_has(7);
  @$pb.TagNumber(8)
  void clearEffectiveMidiMode() => $_clearField(8);

  @$pb.TagNumber(9)
  $core.bool get isCaller => $_getBF(8);
  @$pb.TagNumber(9)
  set isCaller($core.bool value) => $_setBool(8, value);
  @$pb.TagNumber(9)
  $core.bool hasIsCaller() => $_has(8);
  @$pb.TagNumber(9)
  void clearIsCaller() => $_clearField(9);

  @$pb.TagNumber(10)
  $fixnum.Int64 get lastSeenUnix => $_getI64(9);
  @$pb.TagNumber(10)
  set lastSeenUnix($fixnum.Int64 value) => $_setInt64(9, value);
  @$pb.TagNumber(10)
  $core.bool hasLastSeenUnix() => $_has(9);
  @$pb.TagNumber(10)
  void clearLastSeenUnix() => $_clearField(10);
}

/// A device token with its user; the token is shown once and only its hash is stored (plan 5).
class AuthToken extends $pb.GeneratedMessage {
  factory AuthToken({
    $core.String? token,
    $core.String? deviceId,
    User? user,
  }) {
    final result = AuthToken._();
    if (token != null) result.token = token;
    if (deviceId != null) result.deviceId = deviceId;
    if (user != null) result.user = user;
    return result;
  }

  AuthToken._();

  factory AuthToken.fromBuffer($core.List<$core.int> data,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AuthToken()..mergeFromBuffer(data, registry);
  factory AuthToken.fromJson($core.String json,
          [$pb.ExtensionRegistry registry = $pb.ExtensionRegistry.EMPTY]) =>
      AuthToken()..mergeFromJson(json, registry);

  static final $pb.BuilderInfo _i = $pb.BuilderInfo(
      _omitMessageNames ? '' : 'AuthToken',
      package: const $pb.PackageName(_omitMessageNames ? '' : 'kantahe.v1'),
      createEmptyInstance: AuthToken.$_createMessage)
    ..aOS(1, _omitFieldNames ? '' : 'token')
    ..aOS(2, _omitFieldNames ? '' : 'deviceId')
    ..aOM<User>(3, _omitFieldNames ? '' : 'user',
        subBuilder: User.$_createMessage)
    ..hasRequiredFields = false;

  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AuthToken clone() => deepCopy();
  @$core.Deprecated('See https://github.com/google/protobuf.dart/issues/998.')
  AuthToken copyWith(void Function(AuthToken) updates) =>
      super.copyWith((message) => updates(message as AuthToken)) as AuthToken;

  @$core.override
  $pb.BuilderInfo get info_ => _i;

  @$core.pragma('dart2js:noInline')
  @$core.Deprecated('Use AuthToken() / AuthToken.new instead')
  static AuthToken create() => AuthToken._();
  static $pb.GeneratedMessage $_createMessage() => AuthToken._();
  @$core.override
  AuthToken createEmptyInstance() => AuthToken._();
  @$core.pragma('dart2js:noInline')
  static AuthToken getDefault() => _defaultInstance ??=
      $pb.GeneratedMessage.$_defaultFor<AuthToken>(AuthToken.$_createMessage);
  static AuthToken? _defaultInstance;

  @$pb.TagNumber(1)
  $core.String get token => $_getSZ(0);
  @$pb.TagNumber(1)
  set token($core.String value) => $_setString(0, value);
  @$pb.TagNumber(1)
  $core.bool hasToken() => $_has(0);
  @$pb.TagNumber(1)
  void clearToken() => $_clearField(1);

  @$pb.TagNumber(2)
  $core.String get deviceId => $_getSZ(1);
  @$pb.TagNumber(2)
  set deviceId($core.String value) => $_setString(1, value);
  @$pb.TagNumber(2)
  $core.bool hasDeviceId() => $_has(1);
  @$pb.TagNumber(2)
  void clearDeviceId() => $_clearField(2);

  @$pb.TagNumber(3)
  User get user => $_getN(2);
  @$pb.TagNumber(3)
  set user(User value) => $_setField(3, value);
  @$pb.TagNumber(3)
  $core.bool hasUser() => $_has(2);
  @$pb.TagNumber(3)
  void clearUser() => $_clearField(3);
  @$pb.TagNumber(3)
  User ensureUser() => $_ensure(2);
}

const $core.bool _omitFieldNames =
    $core.bool.fromEnvironment('protobuf.omit_field_names');
const $core.bool _omitMessageNames =
    $core.bool.fromEnvironment('protobuf.omit_message_names');
