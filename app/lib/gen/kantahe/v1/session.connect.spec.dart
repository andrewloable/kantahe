//
//  Generated code. Do not modify.
//  source: kantahe/v1/session.proto
//

import "package:connectrpc/connect.dart" as connect;
import "session.pb.dart" as kantahev1session;

/// Per-user playback state; every RPC acts on the calling user only, never on another user's queue (plan 7).
abstract final class SessionService {
  /// Fully-qualified name of the SessionService service.
  static const name = 'kantahe.v1.SessionService';

  /// Signed-in user. Streams the caller's full State at once and after every change (positions never push).
  static const watchState = connect.Spec(
    '/$name/WatchState',
    connect.StreamType.server,
    kantahev1session.WatchStateRequest.new,
    kantahev1session.WatchStateResponse.new,
  );

  /// Signed-in user. Polling fallback for WatchState.
  static const getState = connect.Spec(
    '/$name/GetState',
    connect.StreamType.unary,
    kantahev1session.GetStateRequest.new,
    kantahev1session.GetStateResponse.new,
  );

  /// Signed-in user. Appends to the caller's queue and never interrupts the current song; NOT_FOUND for an unknown number.
  static const addToQueue = connect.Spec(
    '/$name/AddToQueue',
    connect.StreamType.unary,
    kantahev1session.AddToQueueRequest.new,
    kantahev1session.AddToQueueResponse.new,
  );

  /// Signed-in user. Appends a playlist the caller owns; returns how many songs were added.
  static const addPlaylistToQueue = connect.Spec(
    '/$name/AddPlaylistToQueue',
    connect.StreamType.unary,
    kantahev1session.AddPlaylistToQueueRequest.new,
    kantahev1session.AddPlaylistToQueueResponse.new,
  );

  /// Signed-in user. Removes one of the caller's queue items; NOT_FOUND for an unknown item.
  static const removeFromQueue = connect.Spec(
    '/$name/RemoveFromQueue',
    connect.StreamType.unary,
    kantahev1session.RemoveFromQueueRequest.new,
    kantahev1session.RemoveFromQueueResponse.new,
  );

  /// Signed-in user. Moves one of the caller's queue items to the front; NOT_FOUND for an unknown item.
  static const moveToTop = connect.Spec(
    '/$name/MoveToTop',
    connect.StreamType.unary,
    kantahev1session.MoveToTopRequest.new,
    kantahev1session.MoveToTopResponse.new,
  );

  /// Signed-in user. PLAY_HERE makes the calling device the player; PLAY resumes on the current player; PAUSE and SKIP act from any device.
  static const control = connect.Spec(
    '/$name/Control',
    connect.StreamType.unary,
    kantahev1session.ControlRequest.new,
    kantahev1session.ControlResponse.new,
  );

  /// Signed-in user. Unset optional fields are left unchanged.
  static const updateUserSettings = connect.Spec(
    '/$name/UpdateUserSettings',
    connect.StreamType.unary,
    kantahev1session.UpdateUserSettingsRequest.new,
    kantahev1session.UpdateUserSettingsResponse.new,
  );

  /// Current player device only (FAILED_PRECONDITION otherwise): the song is loaded and can start.
  static const ready = connect.Spec(
    '/$name/Ready',
    connect.StreamType.unary,
    kantahev1session.ReadyRequest.new,
    kantahev1session.ReadyResponse.new,
  );

  /// Current player device only: position in memory, never pushed to watchers.
  static const reportPosition = connect.Spec(
    '/$name/ReportPosition',
    connect.StreamType.unary,
    kantahev1session.ReportPositionRequest.new,
    kantahev1session.ReportPositionResponse.new,
  );

  /// Current player device only: the song ended on its own; loud_readings drive the microphone score.
  static const ended = connect.Spec(
    '/$name/Ended',
    connect.StreamType.unary,
    kantahev1session.EndedRequest.new,
    kantahev1session.EndedResponse.new,
  );

  /// Signed-in user. Whether the calling device has a usable microphone.
  static const reportMic = connect.Spec(
    '/$name/ReportMic',
    connect.StreamType.unary,
    kantahev1session.ReportMicRequest.new,
    kantahev1session.ReportMicResponse.new,
  );

  /// Signed-in user. Memory and dropouts of the calling device; returns the device with its effective MIDI mode.
  static const reportDevice = connect.Spec(
    '/$name/ReportDevice',
    connect.StreamType.unary,
    kantahev1session.ReportDeviceRequest.new,
    kantahev1session.ReportDeviceResponse.new,
  );

  /// Signed-in user. Sets the MIDI mode of one of the caller's devices; NOT_FOUND for another user's device.
  static const setMidiMode = connect.Spec(
    '/$name/SetMidiMode',
    connect.StreamType.unary,
    kantahev1session.SetMidiModeRequest.new,
    kantahev1session.SetMidiModeResponse.new,
  );

  /// Signed-in user. Sets the background video mode of one of the caller's devices; NOT_FOUND for another user's device.
  static const setBackgroundMode = connect.Spec(
    '/$name/SetBackgroundMode',
    connect.StreamType.unary,
    kantahev1session.SetBackgroundModeRequest.new,
    kantahev1session.SetBackgroundModeResponse.new,
  );
}
