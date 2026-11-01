//
//  Generated code. Do not modify.
//  source: kantahe/v1/catalog.proto
//

import "package:connectrpc/connect.dart" as connect;
import "catalog.pb.dart" as kantahev1catalog;
import "catalog.connect.spec.dart" as specs;

/// Read-only library access; any signed-in user (UNAUTHENTICATED otherwise).
extension type CatalogServiceClient (connect.Transport _transport) {
  /// Signed-in user. Digits-only query matches the number prefix, otherwise full-text over title and artist (plan 6).
  Future<kantahev1catalog.SearchSongsResponse> searchSongs(
    kantahev1catalog.SearchSongsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.CatalogService.searchSongs,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Artists with their song counts, optionally restricted to a first letter ("#" for non-letters).
  Future<kantahev1catalog.ListArtistsResponse> listArtists(
    kantahev1catalog.ListArtistsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.CatalogService.listArtists,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Number pad lookup; NOT_FOUND for an unknown number.
  Future<kantahev1catalog.GetSongResponse> getSong(
    kantahev1catalog.GetSongRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.CatalogService.getSong,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Parsed lyrics for a song; NOT_FOUND for an unknown number or a song without lyrics.
  Future<kantahev1catalog.GetLyricsResponse> getLyrics(
    kantahev1catalog.GetLyricsRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.CatalogService.getLyrics,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. Signed URLs, lyrics and the MIDI mode resolved for the calling device (plan 4.1); ready=false means retry later.
  Future<kantahev1catalog.GetPlaybackResponse> getPlayback(
    kantahev1catalog.GetPlaybackRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.CatalogService.getPlayback,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }

  /// Signed-in user. The enabled background videos in loop order with signed URLs (6 hours); empty when the admin has switched the background off.
  Future<kantahev1catalog.GetBackgroundResponse> getBackground(
    kantahev1catalog.GetBackgroundRequest input, {
    connect.Headers? headers,
    connect.AbortSignal? signal,
    Function(connect.Headers)? onHeader,
    Function(connect.Headers)? onTrailer,
  }) {
    return connect.Client(_transport).unary(
      specs.CatalogService.getBackground,
      input,
      signal: signal,
      headers: headers,
      onHeader: onHeader,
      onTrailer: onTrailer,
    );
  }
}
