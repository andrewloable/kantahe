//
//  Generated code. Do not modify.
//  source: kantahe/v1/session.proto
//

import "package:connectrpc/connect.dart" as connect;
import "session.pb.dart" as kantahev1session;
import "session.connect.spec.dart" as specs;

/// Per-user playback state; every RPC acts on the calling user only, never on another user's queue (plan 7).
extension type SessionServiceClient (connect.Transport _transport) {
  /// Signed-in user. Streams the caller's full State at once and after every change (positions never push).
  Stream<kantahev1session.WatchStateResponse> watchState(
    kantahev1session.WatchStateRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).server(
      specs.SessionService.watchState,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Polling fallback for WatchState.
  Future<kantahev1session.GetStateResponse> getState(
    kantahev1session.GetStateRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.getState,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Appends to the caller's queue and never interrupts the current song; NOT_FOUND for an unknown number.
  Future<kantahev1session.AddToQueueResponse> addToQueue(
    kantahev1session.AddToQueueRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.addToQueue,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Appends a playlist the caller owns; returns how many songs were added.
  Future<kantahev1session.AddPlaylistToQueueResponse> addPlaylistToQueue(
    kantahev1session.AddPlaylistToQueueRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.addPlaylistToQueue,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Removes one of the caller's queue items; NOT_FOUND for an unknown item.
  Future<kantahev1session.RemoveFromQueueResponse> removeFromQueue(
    kantahev1session.RemoveFromQueueRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.removeFromQueue,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Moves one of the caller's queue items to the front; NOT_FOUND for an unknown item.
  Future<kantahev1session.MoveToTopResponse> moveToTop(
    kantahev1session.MoveToTopRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.moveToTop,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. PLAY_HERE makes the calling device the player; PLAY resumes on the current player; PAUSE and SKIP act from any device.
  Future<kantahev1session.ControlResponse> control(
    kantahev1session.ControlRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.control,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Unset optional fields are left unchanged.
  Future<kantahev1session.UpdateUserSettingsResponse> updateUserSettings(
    kantahev1session.UpdateUserSettingsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.updateUserSettings,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Current player device only (FAILED_PRECONDITION otherwise): the song is loaded and can start.
  Future<kantahev1session.ReadyResponse> ready(
    kantahev1session.ReadyRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.ready,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Current player device only: position in memory, never pushed to watchers.
  Future<kantahev1session.ReportPositionResponse> reportPosition(
    kantahev1session.ReportPositionRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.reportPosition,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Current player device only: the song ended on its own; loud_readings drive the microphone score.
  Future<kantahev1session.EndedResponse> ended(
    kantahev1session.EndedRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.ended,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Whether the calling device has a usable microphone.
  Future<kantahev1session.ReportMicResponse> reportMic(
    kantahev1session.ReportMicRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.reportMic,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Memory and dropouts of the calling device; returns the device with its effective MIDI mode.
  Future<kantahev1session.ReportDeviceResponse> reportDevice(
    kantahev1session.ReportDeviceRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.reportDevice,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Sets the MIDI mode of one of the caller's devices; NOT_FOUND for another user's device.
  Future<kantahev1session.SetMidiModeResponse> setMidiMode(
    kantahev1session.SetMidiModeRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.setMidiMode,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Sets the background video mode of one of the caller's devices; NOT_FOUND for another user's device.
  Future<kantahev1session.SetBackgroundModeResponse> setBackgroundMode(
    kantahev1session.SetBackgroundModeRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.SessionService.setBackgroundMode,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }
}
