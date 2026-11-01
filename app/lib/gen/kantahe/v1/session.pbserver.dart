// This is a generated file - do not edit.
//
// Generated from kantahe/v1/session.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'session.pb.dart' as $1;
import 'session.pbjson.dart';

export 'session.pb.dart';

abstract class SessionServiceBase extends $pb.GeneratedService {
  $async.Future<$1.WatchStateResponse> watchState(
      $pb.ServerContext ctx, $1.WatchStateRequest request);
  $async.Future<$1.GetStateResponse> getState(
      $pb.ServerContext ctx, $1.GetStateRequest request);
  $async.Future<$1.AddToQueueResponse> addToQueue(
      $pb.ServerContext ctx, $1.AddToQueueRequest request);
  $async.Future<$1.AddPlaylistToQueueResponse> addPlaylistToQueue(
      $pb.ServerContext ctx, $1.AddPlaylistToQueueRequest request);
  $async.Future<$1.RemoveFromQueueResponse> removeFromQueue(
      $pb.ServerContext ctx, $1.RemoveFromQueueRequest request);
  $async.Future<$1.MoveToTopResponse> moveToTop(
      $pb.ServerContext ctx, $1.MoveToTopRequest request);
  $async.Future<$1.ControlResponse> control(
      $pb.ServerContext ctx, $1.ControlRequest request);
  $async.Future<$1.UpdateUserSettingsResponse> updateUserSettings(
      $pb.ServerContext ctx, $1.UpdateUserSettingsRequest request);
  $async.Future<$1.ReadyResponse> ready(
      $pb.ServerContext ctx, $1.ReadyRequest request);
  $async.Future<$1.ReportPositionResponse> reportPosition(
      $pb.ServerContext ctx, $1.ReportPositionRequest request);
  $async.Future<$1.EndedResponse> ended(
      $pb.ServerContext ctx, $1.EndedRequest request);
  $async.Future<$1.ReportMicResponse> reportMic(
      $pb.ServerContext ctx, $1.ReportMicRequest request);
  $async.Future<$1.ReportDeviceResponse> reportDevice(
      $pb.ServerContext ctx, $1.ReportDeviceRequest request);
  $async.Future<$1.SetMidiModeResponse> setMidiMode(
      $pb.ServerContext ctx, $1.SetMidiModeRequest request);
  $async.Future<$1.SetBackgroundModeResponse> setBackgroundMode(
      $pb.ServerContext ctx, $1.SetBackgroundModeRequest request);

  $pb.GeneratedMessage createRequest($core.String methodName) {
    switch (methodName) {
      case 'WatchState':
        return $1.WatchStateRequest();
      case 'GetState':
        return $1.GetStateRequest();
      case 'AddToQueue':
        return $1.AddToQueueRequest();
      case 'AddPlaylistToQueue':
        return $1.AddPlaylistToQueueRequest();
      case 'RemoveFromQueue':
        return $1.RemoveFromQueueRequest();
      case 'MoveToTop':
        return $1.MoveToTopRequest();
      case 'Control':
        return $1.ControlRequest();
      case 'UpdateUserSettings':
        return $1.UpdateUserSettingsRequest();
      case 'Ready':
        return $1.ReadyRequest();
      case 'ReportPosition':
        return $1.ReportPositionRequest();
      case 'Ended':
        return $1.EndedRequest();
      case 'ReportMic':
        return $1.ReportMicRequest();
      case 'ReportDevice':
        return $1.ReportDeviceRequest();
      case 'SetMidiMode':
        return $1.SetMidiModeRequest();
      case 'SetBackgroundMode':
        return $1.SetBackgroundModeRequest();
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $async.Future<$pb.GeneratedMessage> handleCall($pb.ServerContext ctx,
      $core.String methodName, $pb.GeneratedMessage request) {
    switch (methodName) {
      case 'WatchState':
        return watchState(ctx, request as $1.WatchStateRequest);
      case 'GetState':
        return getState(ctx, request as $1.GetStateRequest);
      case 'AddToQueue':
        return addToQueue(ctx, request as $1.AddToQueueRequest);
      case 'AddPlaylistToQueue':
        return addPlaylistToQueue(ctx, request as $1.AddPlaylistToQueueRequest);
      case 'RemoveFromQueue':
        return removeFromQueue(ctx, request as $1.RemoveFromQueueRequest);
      case 'MoveToTop':
        return moveToTop(ctx, request as $1.MoveToTopRequest);
      case 'Control':
        return control(ctx, request as $1.ControlRequest);
      case 'UpdateUserSettings':
        return updateUserSettings(ctx, request as $1.UpdateUserSettingsRequest);
      case 'Ready':
        return ready(ctx, request as $1.ReadyRequest);
      case 'ReportPosition':
        return reportPosition(ctx, request as $1.ReportPositionRequest);
      case 'Ended':
        return ended(ctx, request as $1.EndedRequest);
      case 'ReportMic':
        return reportMic(ctx, request as $1.ReportMicRequest);
      case 'ReportDevice':
        return reportDevice(ctx, request as $1.ReportDeviceRequest);
      case 'SetMidiMode':
        return setMidiMode(ctx, request as $1.SetMidiModeRequest);
      case 'SetBackgroundMode':
        return setBackgroundMode(ctx, request as $1.SetBackgroundModeRequest);
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $core.Map<$core.String, $core.dynamic> get $json => SessionServiceBase$json;
  $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
      get $messageJson => SessionServiceBase$messageJson;
}
