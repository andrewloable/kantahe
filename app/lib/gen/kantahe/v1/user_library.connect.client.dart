//
//  Generated code. Do not modify.
//  source: kantahe/v1/user_library.proto
//

import "package:connectrpc/connect.dart" as connect;
import "user_library.pb.dart" as kantahev1user_library;
import "user_library.connect.spec.dart" as specs;

/// Favourites, history and playlists; always the calling user's own data.
extension type UserLibraryServiceClient (connect.Transport _transport) {
  /// Signed-in user; NOT_FOUND for an unknown song.
  Future<kantahev1user_library.SetFavouriteResponse> setFavourite(
    kantahev1user_library.SetFavouriteRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.setFavourite,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; the caller's favourites.
  Future<kantahev1user_library.ListFavouritesResponse> listFavourites(
    kantahev1user_library.ListFavouritesRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.listFavourites,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; the caller's sung songs.
  Future<kantahev1user_library.ListHistoryResponse> listHistory(
    kantahev1user_library.ListHistoryRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.listHistory,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; the caller's playlists.
  Future<kantahev1user_library.ListPlaylistsResponse> listPlaylists(
    kantahev1user_library.ListPlaylistsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.listPlaylists,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; NOT_FOUND for another user's playlist.
  Future<kantahev1user_library.GetPlaylistResponse> getPlaylist(
    kantahev1user_library.GetPlaylistRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.getPlaylist,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; numbers that do not exist are rejected with INVALID_ARGUMENT.
  Future<kantahev1user_library.CreatePlaylistResponse> createPlaylist(
    kantahev1user_library.CreatePlaylistRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.createPlaylist,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; NOT_FOUND for another user's playlist; numbers are replaced only when replace_numbers is true.
  Future<kantahev1user_library.UpdatePlaylistResponse> updatePlaylist(
    kantahev1user_library.UpdatePlaylistRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.updatePlaylist,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user; NOT_FOUND for another user's playlist.
  Future<kantahev1user_library.DeletePlaylistResponse> deletePlaylist(
    kantahev1user_library.DeletePlaylistRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.UserLibraryService.deletePlaylist,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }
}
