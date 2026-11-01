// This is a generated file - do not edit.
//
// Generated from kantahe/v1/catalog.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'catalog.pb.dart' as $1;
import 'catalog.pbjson.dart';

export 'catalog.pb.dart';

abstract class CatalogServiceBase extends $pb.GeneratedService {
  $async.Future<$1.SearchSongsResponse> searchSongs(
      $pb.ServerContext ctx, $1.SearchSongsRequest request);
  $async.Future<$1.ListArtistsResponse> listArtists(
      $pb.ServerContext ctx, $1.ListArtistsRequest request);
  $async.Future<$1.GetSongResponse> getSong(
      $pb.ServerContext ctx, $1.GetSongRequest request);
  $async.Future<$1.GetLyricsResponse> getLyrics(
      $pb.ServerContext ctx, $1.GetLyricsRequest request);
  $async.Future<$1.GetPlaybackResponse> getPlayback(
      $pb.ServerContext ctx, $1.GetPlaybackRequest request);
  $async.Future<$1.GetBackgroundResponse> getBackground(
      $pb.ServerContext ctx, $1.GetBackgroundRequest request);

  $pb.GeneratedMessage createRequest($core.String methodName) {
    switch (methodName) {
      case 'SearchSongs':
        return $1.SearchSongsRequest();
      case 'ListArtists':
        return $1.ListArtistsRequest();
      case 'GetSong':
        return $1.GetSongRequest();
      case 'GetLyrics':
        return $1.GetLyricsRequest();
      case 'GetPlayback':
        return $1.GetPlaybackRequest();
      case 'GetBackground':
        return $1.GetBackgroundRequest();
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $async.Future<$pb.GeneratedMessage> handleCall($pb.ServerContext ctx,
      $core.String methodName, $pb.GeneratedMessage request) {
    switch (methodName) {
      case 'SearchSongs':
        return searchSongs(ctx, request as $1.SearchSongsRequest);
      case 'ListArtists':
        return listArtists(ctx, request as $1.ListArtistsRequest);
      case 'GetSong':
        return getSong(ctx, request as $1.GetSongRequest);
      case 'GetLyrics':
        return getLyrics(ctx, request as $1.GetLyricsRequest);
      case 'GetPlayback':
        return getPlayback(ctx, request as $1.GetPlaybackRequest);
      case 'GetBackground':
        return getBackground(ctx, request as $1.GetBackgroundRequest);
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $core.Map<$core.String, $core.dynamic> get $json => CatalogServiceBase$json;
  $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
      get $messageJson => CatalogServiceBase$messageJson;
}
