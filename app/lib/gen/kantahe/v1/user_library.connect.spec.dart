//
//  Generated code. Do not modify.
//  source: kantahe/v1/user_library.proto
//

import "package:connectrpc/connect.dart" as connect;
import "user_library.pb.dart" as kantahev1user_library;

/// Favourites, history and playlists; always the calling user's own data.
abstract final class UserLibraryService {
  /// Fully-qualified name of the UserLibraryService service.
  static const name = 'kantahe.v1.UserLibraryService';

  /// Signed-in user; NOT_FOUND for an unknown song.
  static const setFavourite = connect.Spec(
    '/$name/SetFavourite',
    connect.StreamType.unary,
    kantahev1user_library.SetFavouriteRequest.new,
    kantahev1user_library.SetFavouriteResponse.new,
  );

  /// Signed-in user; the caller's favourites.
  static const listFavourites = connect.Spec(
    '/$name/ListFavourites',
    connect.StreamType.unary,
    kantahev1user_library.ListFavouritesRequest.new,
    kantahev1user_library.ListFavouritesResponse.new,
  );

  /// Signed-in user; the caller's sung songs.
  static const listHistory = connect.Spec(
    '/$name/ListHistory',
    connect.StreamType.unary,
    kantahev1user_library.ListHistoryRequest.new,
    kantahev1user_library.ListHistoryResponse.new,
  );

  /// Signed-in user; the caller's playlists.
  static const listPlaylists = connect.Spec(
    '/$name/ListPlaylists',
    connect.StreamType.unary,
    kantahev1user_library.ListPlaylistsRequest.new,
    kantahev1user_library.ListPlaylistsResponse.new,
  );

  /// Signed-in user; NOT_FOUND for another user's playlist.
  static const getPlaylist = connect.Spec(
    '/$name/GetPlaylist',
    connect.StreamType.unary,
    kantahev1user_library.GetPlaylistRequest.new,
    kantahev1user_library.GetPlaylistResponse.new,
  );

  /// Signed-in user; numbers that do not exist are rejected with INVALID_ARGUMENT.
  static const createPlaylist = connect.Spec(
    '/$name/CreatePlaylist',
    connect.StreamType.unary,
    kantahev1user_library.CreatePlaylistRequest.new,
    kantahev1user_library.CreatePlaylistResponse.new,
  );

  /// Signed-in user; NOT_FOUND for another user's playlist; numbers are replaced only when replace_numbers is true.
  static const updatePlaylist = connect.Spec(
    '/$name/UpdatePlaylist',
    connect.StreamType.unary,
    kantahev1user_library.UpdatePlaylistRequest.new,
    kantahev1user_library.UpdatePlaylistResponse.new,
  );

  /// Signed-in user; NOT_FOUND for another user's playlist.
  static const deletePlaylist = connect.Spec(
    '/$name/DeletePlaylist',
    connect.StreamType.unary,
    kantahev1user_library.DeletePlaylistRequest.new,
    kantahev1user_library.DeletePlaylistResponse.new,
  );
}
