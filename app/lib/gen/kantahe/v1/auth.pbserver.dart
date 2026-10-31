// This is a generated file - do not edit.
//
// Generated from kantahe/v1/auth.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'auth.pb.dart' as $1;
import 'auth.pbjson.dart';

export 'auth.pb.dart';

abstract class AuthServiceBase extends $pb.GeneratedService {
  $async.Future<$1.GetServerInfoResponse> getServerInfo(
      $pb.ServerContext ctx, $1.GetServerInfoRequest request);
  $async.Future<$1.SetupResponse> setup(
      $pb.ServerContext ctx, $1.SetupRequest request);
  $async.Future<$1.LoginResponse> login(
      $pb.ServerContext ctx, $1.LoginRequest request);
  $async.Future<$1.LogoutResponse> logout(
      $pb.ServerContext ctx, $1.LogoutRequest request);
  $async.Future<$1.ChangePasswordResponse> changePassword(
      $pb.ServerContext ctx, $1.ChangePasswordRequest request);
  $async.Future<$1.MeResponse> me($pb.ServerContext ctx, $1.MeRequest request);
  $async.Future<$1.ListMyDevicesResponse> listMyDevices(
      $pb.ServerContext ctx, $1.ListMyDevicesRequest request);
  $async.Future<$1.RevokeDeviceResponse> revokeDevice(
      $pb.ServerContext ctx, $1.RevokeDeviceRequest request);
  $async.Future<$1.StartCodeLoginResponse> startCodeLogin(
      $pb.ServerContext ctx, $1.StartCodeLoginRequest request);
  $async.Future<$1.WaitCodeLoginResponse> waitCodeLogin(
      $pb.ServerContext ctx, $1.WaitCodeLoginRequest request);
  $async.Future<$1.ApproveCodeResponse> approveCode(
      $pb.ServerContext ctx, $1.ApproveCodeRequest request);

  $pb.GeneratedMessage createRequest($core.String methodName) {
    switch (methodName) {
      case 'GetServerInfo':
        return $1.GetServerInfoRequest();
      case 'Setup':
        return $1.SetupRequest();
      case 'Login':
        return $1.LoginRequest();
      case 'Logout':
        return $1.LogoutRequest();
      case 'ChangePassword':
        return $1.ChangePasswordRequest();
      case 'Me':
        return $1.MeRequest();
      case 'ListMyDevices':
        return $1.ListMyDevicesRequest();
      case 'RevokeDevice':
        return $1.RevokeDeviceRequest();
      case 'StartCodeLogin':
        return $1.StartCodeLoginRequest();
      case 'WaitCodeLogin':
        return $1.WaitCodeLoginRequest();
      case 'ApproveCode':
        return $1.ApproveCodeRequest();
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $async.Future<$pb.GeneratedMessage> handleCall($pb.ServerContext ctx,
      $core.String methodName, $pb.GeneratedMessage request) {
    switch (methodName) {
      case 'GetServerInfo':
        return getServerInfo(ctx, request as $1.GetServerInfoRequest);
      case 'Setup':
        return setup(ctx, request as $1.SetupRequest);
      case 'Login':
        return login(ctx, request as $1.LoginRequest);
      case 'Logout':
        return logout(ctx, request as $1.LogoutRequest);
      case 'ChangePassword':
        return changePassword(ctx, request as $1.ChangePasswordRequest);
      case 'Me':
        return me(ctx, request as $1.MeRequest);
      case 'ListMyDevices':
        return listMyDevices(ctx, request as $1.ListMyDevicesRequest);
      case 'RevokeDevice':
        return revokeDevice(ctx, request as $1.RevokeDeviceRequest);
      case 'StartCodeLogin':
        return startCodeLogin(ctx, request as $1.StartCodeLoginRequest);
      case 'WaitCodeLogin':
        return waitCodeLogin(ctx, request as $1.WaitCodeLoginRequest);
      case 'ApproveCode':
        return approveCode(ctx, request as $1.ApproveCodeRequest);
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $core.Map<$core.String, $core.dynamic> get $json => AuthServiceBase$json;
  $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
      get $messageJson => AuthServiceBase$messageJson;
}
