// This is a generated file - do not edit.
//
// Generated from kantahe/v1/admin.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'admin.pb.dart' as $1;
import 'admin.pbjson.dart';

export 'admin.pb.dart';

abstract class AdminServiceBase extends $pb.GeneratedService {
  $async.Future<$1.ListUsersResponse> listUsers(
      $pb.ServerContext ctx, $1.ListUsersRequest request);
  $async.Future<$1.CreateUserResponse> createUser(
      $pb.ServerContext ctx, $1.CreateUserRequest request);
  $async.Future<$1.UpdateUserResponse> updateUser(
      $pb.ServerContext ctx, $1.UpdateUserRequest request);
  $async.Future<$1.ResetPasswordResponse> resetPassword(
      $pb.ServerContext ctx, $1.ResetPasswordRequest request);
  $async.Future<$1.DeleteUserResponse> deleteUser(
      $pb.ServerContext ctx, $1.DeleteUserRequest request);
  $async.Future<$1.RevokeUserDevicesResponse> revokeUserDevices(
      $pb.ServerContext ctx, $1.RevokeUserDevicesRequest request);
  $async.Future<$1.UpdateSongResponse> updateSong(
      $pb.ServerContext ctx, $1.UpdateSongRequest request);
  $async.Future<$1.DeleteSongResponse> deleteSong(
      $pb.ServerContext ctx, $1.DeleteSongRequest request);
  $async.Future<$1.RescanResponse> rescan(
      $pb.ServerContext ctx, $1.RescanRequest request);
  $async.Future<$1.GetServerSettingsResponse> getServerSettings(
      $pb.ServerContext ctx, $1.GetServerSettingsRequest request);
  $async.Future<$1.UpdateServerSettingsResponse> updateServerSettings(
      $pb.ServerContext ctx, $1.UpdateServerSettingsRequest request);

  $pb.GeneratedMessage createRequest($core.String methodName) {
    switch (methodName) {
      case 'ListUsers':
        return $1.ListUsersRequest();
      case 'CreateUser':
        return $1.CreateUserRequest();
      case 'UpdateUser':
        return $1.UpdateUserRequest();
      case 'ResetPassword':
        return $1.ResetPasswordRequest();
      case 'DeleteUser':
        return $1.DeleteUserRequest();
      case 'RevokeUserDevices':
        return $1.RevokeUserDevicesRequest();
      case 'UpdateSong':
        return $1.UpdateSongRequest();
      case 'DeleteSong':
        return $1.DeleteSongRequest();
      case 'Rescan':
        return $1.RescanRequest();
      case 'GetServerSettings':
        return $1.GetServerSettingsRequest();
      case 'UpdateServerSettings':
        return $1.UpdateServerSettingsRequest();
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $async.Future<$pb.GeneratedMessage> handleCall($pb.ServerContext ctx,
      $core.String methodName, $pb.GeneratedMessage request) {
    switch (methodName) {
      case 'ListUsers':
        return listUsers(ctx, request as $1.ListUsersRequest);
      case 'CreateUser':
        return createUser(ctx, request as $1.CreateUserRequest);
      case 'UpdateUser':
        return updateUser(ctx, request as $1.UpdateUserRequest);
      case 'ResetPassword':
        return resetPassword(ctx, request as $1.ResetPasswordRequest);
      case 'DeleteUser':
        return deleteUser(ctx, request as $1.DeleteUserRequest);
      case 'RevokeUserDevices':
        return revokeUserDevices(ctx, request as $1.RevokeUserDevicesRequest);
      case 'UpdateSong':
        return updateSong(ctx, request as $1.UpdateSongRequest);
      case 'DeleteSong':
        return deleteSong(ctx, request as $1.DeleteSongRequest);
      case 'Rescan':
        return rescan(ctx, request as $1.RescanRequest);
      case 'GetServerSettings':
        return getServerSettings(ctx, request as $1.GetServerSettingsRequest);
      case 'UpdateServerSettings':
        return updateServerSettings(
            ctx, request as $1.UpdateServerSettingsRequest);
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $core.Map<$core.String, $core.dynamic> get $json => AdminServiceBase$json;
  $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
      get $messageJson => AdminServiceBase$messageJson;
}
