// This is a generated file - do not edit.
//
// Generated from kantahe/v1/upload.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

/// Outcome of one upload.
class UploadStatus extends $pb.ProtobufEnum {
  static const UploadStatus UPLOAD_STATUS_UNSPECIFIED =
      UploadStatus._(0, _omitEnumNames ? '' : 'UPLOAD_STATUS_UNSPECIFIED');
  static const UploadStatus UPLOAD_STATUS_ADDED =
      UploadStatus._(1, _omitEnumNames ? '' : 'UPLOAD_STATUS_ADDED');
  static const UploadStatus UPLOAD_STATUS_DUPLICATE =
      UploadStatus._(2, _omitEnumNames ? '' : 'UPLOAD_STATUS_DUPLICATE');
  static const UploadStatus UPLOAD_STATUS_REJECTED =
      UploadStatus._(3, _omitEnumNames ? '' : 'UPLOAD_STATUS_REJECTED');

  static const $core.List<UploadStatus> values = <UploadStatus>[
    UPLOAD_STATUS_UNSPECIFIED,
    UPLOAD_STATUS_ADDED,
    UPLOAD_STATUS_DUPLICATE,
    UPLOAD_STATUS_REJECTED,
  ];

  static final $core.List<UploadStatus?> _byValue =
      $pb.ProtobufEnum.$_initByValueList(values, 3);
  static UploadStatus? valueOf($core.int value) =>
      value < 0 || value >= _byValue.length ? null : _byValue[value];

  const UploadStatus._(super.value, super.name);
}

const $core.bool _omitEnumNames =
    $core.bool.fromEnvironment('protobuf.omit_enum_names');
