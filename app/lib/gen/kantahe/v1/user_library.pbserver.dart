// This is a generated file - do not edit.
//
// Generated from kantahe/v1/user_library.proto.

// @dart = 3.3

// ignore_for_file: annotate_overrides, camel_case_types, comment_references
// ignore_for_file: constant_identifier_names
// ignore_for_file: curly_braces_in_flow_control_structures
// ignore_for_file: deprecated_member_use_from_same_package, library_prefixes
// ignore_for_file: non_constant_identifier_names, prefer_relative_imports

import 'dart:async' as $async;
import 'dart:core' as $core;

import 'package:protobuf/protobuf.dart' as $pb;

import 'user_library.pb.dart' as $1;
import 'user_library.pbjson.dart';

export 'user_library.pb.dart';

abstract class UserLibraryServiceBase extends $pb.GeneratedService {
  $async.Future<$1.SetFavouriteResponse> setFavourite(
      $pb.ServerContext ctx, $1.SetFavouriteRequest request);
  $async.Future<$1.ListFavouritesResponse> listFavourites(
      $pb.ServerContext ctx, $1.ListFavouritesRequest request);
  $async.Future<$1.ListHistoryResponse> listHistory(
      $pb.ServerContext ctx, $1.ListHistoryRequest request);
  $async.Future<$1.ListPlaylistsResponse> listPlaylists(
      $pb.ServerContext ctx, $1.ListPlaylistsRequest request);
  $async.Future<$1.GetPlaylistResponse> getPlaylist(
      $pb.ServerContext ctx, $1.GetPlaylistRequest request);
  $async.Future<$1.CreatePlaylistResponse> createPlaylist(
      $pb.ServerContext ctx, $1.CreatePlaylistRequest request);
  $async.Future<$1.UpdatePlaylistResponse> updatePlaylist(
      $pb.ServerContext ctx, $1.UpdatePlaylistRequest request);
  $async.Future<$1.DeletePlaylistResponse> deletePlaylist(
      $pb.ServerContext ctx, $1.DeletePlaylistRequest request);

  $pb.GeneratedMessage createRequest($core.String methodName) {
    switch (methodName) {
      case 'SetFavourite':
        return $1.SetFavouriteRequest();
      case 'ListFavourites':
        return $1.ListFavouritesRequest();
      case 'ListHistory':
        return $1.ListHistoryRequest();
      case 'ListPlaylists':
        return $1.ListPlaylistsRequest();
      case 'GetPlaylist':
        return $1.GetPlaylistRequest();
      case 'CreatePlaylist':
        return $1.CreatePlaylistRequest();
      case 'UpdatePlaylist':
        return $1.UpdatePlaylistRequest();
      case 'DeletePlaylist':
        return $1.DeletePlaylistRequest();
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $async.Future<$pb.GeneratedMessage> handleCall($pb.ServerContext ctx,
      $core.String methodName, $pb.GeneratedMessage request) {
    switch (methodName) {
      case 'SetFavourite':
        return setFavourite(ctx, request as $1.SetFavouriteRequest);
      case 'ListFavourites':
        return listFavourites(ctx, request as $1.ListFavouritesRequest);
      case 'ListHistory':
        return listHistory(ctx, request as $1.ListHistoryRequest);
      case 'ListPlaylists':
        return listPlaylists(ctx, request as $1.ListPlaylistsRequest);
      case 'GetPlaylist':
        return getPlaylist(ctx, request as $1.GetPlaylistRequest);
      case 'CreatePlaylist':
        return createPlaylist(ctx, request as $1.CreatePlaylistRequest);
      case 'UpdatePlaylist':
        return updatePlaylist(ctx, request as $1.UpdatePlaylistRequest);
      case 'DeletePlaylist':
        return deletePlaylist(ctx, request as $1.DeletePlaylistRequest);
      default:
        throw $core.ArgumentError('Unknown method: $methodName');
    }
  }

  $core.Map<$core.String, $core.dynamic> get $json =>
      UserLibraryServiceBase$json;
  $core.Map<$core.String, $core.Map<$core.String, $core.dynamic>>
      get $messageJson => UserLibraryServiceBase$messageJson;
}
