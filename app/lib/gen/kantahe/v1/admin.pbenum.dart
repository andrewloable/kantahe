// This is a generated file - do not edit.
//
// Generated from kantahe/v1/admin.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

/// Which songs RemoveSongs takes off the list.
class RemoveScope extends $pb.ProtobufEnum {
  static const RemoveScope REMOVE_SCOPE_UNSPECIFIED =
      RemoveScope._(0, _omitEnumNames ? '' : 'REMOVE_SCOPE_UNSPECIFIED');

  /// Every live song that is marked broken (by CheckLibrary or at import).
  static const RemoveScope REMOVE_SCOPE_BROKEN =
      RemoveScope._(3, _omitEnumNames ? '' : 'REMOVE_SCOPE_BROKEN');

  static const $core.List<RemoveScope> values = <RemoveScope>[
    REMOVE_SCOPE_UNSPECIFIED,
    REMOVE_SCOPE_BROKEN,
  ];

  static final $core.Map<$core.int, RemoveScope> _byValue =
      $pb.ProtobufEnum.initByValue(values);
  static RemoveScope? valueOf($core.int value) => _byValue[value];

  const RemoveScope._(super.value, super.name);
}

const $core.bool _omitEnumNames =
    $core.bool.fromEnvironment('protobuf.omit_enum_names');
