//
//  Generated code. Do not modify.
//  source: kantahe/v1/catalog.proto
//

import "package:connectrpc/connect.dart" as connect;
import "catalog.pb.dart" as kantahev1catalog;

/// Read-only library access; any signed-in user (UNAUTHENTICATED otherwise).
abstract final class CatalogService {
  /// Fully-qualified name of the CatalogService service.
  static const name = 'kantahe.v1.CatalogService';

  /// Signed-in user. Digits-only query matches the number prefix, otherwise full-text over title and artist (plan 6).
  static const searchSongs = connect.Spec(
    '/$name/SearchSongs',
    connect.StreamType.unary,
    kantahev1catalog.SearchSongsRequest.new,
    kantahev1catalog.SearchSongsResponse.new,
  );

  /// Signed-in user. Artists with their song counts, optionally restricted to a first letter ("#" for non-letters).
  static const listArtists = connect.Spec(
    '/$name/ListArtists',
    connect.StreamType.unary,
    kantahev1catalog.ListArtistsRequest.new,
    kantahev1catalog.ListArtistsResponse.new,
  );

  /// Signed-in user. Number pad lookup; NOT_FOUND for an unknown number.
  static const getSong = connect.Spec(
    '/$name/GetSong',
    connect.StreamType.unary,
    kantahev1catalog.GetSongRequest.new,
    kantahev1catalog.GetSongResponse.new,
  );

  /// Signed-in user. Parsed lyrics for a song; NOT_FOUND for an unknown number or a song without lyrics.
  static const getLyrics = connect.Spec(
    '/$name/GetLyrics',
    connect.StreamType.unary,
    kantahev1catalog.GetLyricsRequest.new,
    kantahev1catalog.GetLyricsResponse.new,
  );

  /// Signed-in user. Signed URLs, lyrics and the MIDI mode resolved for the calling device (plan 4.1); ready=false means retry later.
  static const getPlayback = connect.Spec(
    '/$name/GetPlayback',
    connect.StreamType.unary,
    kantahev1catalog.GetPlaybackRequest.new,
    kantahev1catalog.GetPlaybackResponse.new,
  );

  /// Signed-in user. The enabled background videos in loop order with signed URLs (6 hours); empty when the admin has switched the background off.
  static const getBackground = connect.Spec(
    '/$name/GetBackground',
    connect.StreamType.unary,
    kantahev1catalog.GetBackgroundRequest.new,
    kantahev1catalog.GetBackgroundResponse.new,
  );
}
