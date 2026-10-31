// Runs the Me screens and the upload against a real Kantahe server (the synthetic library of kantahe-fixtures):
//
//   flutter test integration_test/me_flow_test.dart -d <simulator> \
//     --dart-define=SERVER_URL=http://127.0.0.1:8080 --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=... \
//     --dart-define=UPLOAD_KAR=/path/to/one.kar --dart-define=UPLOAD_ZIP=/path/to/songs.zip
//
// USER_* is an account with the uploader role. The files are read from the machine the simulator runs on, so
// this runs on the iOS simulator (not on an Android emulator). Without SERVER_URL the test is skipped.
import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/me/favourites_screen.dart';
import 'package:kantahe/me/me_screen.dart';
import 'package:kantahe/me/my_devices_screen.dart';
import 'package:kantahe/me/playlist_detail_screen.dart';
import 'package:kantahe/me/playlists_screen.dart';
import 'package:kantahe/me/score_settings_screen.dart';
import 'package:kantahe/upload/upload_screen.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');
const uploadKar = String.fromEnvironment('UPLOAD_KAR');
const uploadZip = String.fromEnvironment('UPLOAD_ZIP');

class DiskFile implements PickedFile {
  DiskFile(this.path) : size = File(path).lengthSync();

  final String path;
  @override
  final int size;

  @override
  String get name => path.split('/').last;

  @override
  Future<Uint8List> readAll() => File(path).readAsBytes();

  @override
  Future<InputStream> openStream() async => InputFileStream(path);
}

Future<void> until(WidgetTester tester, bool Function() done, String what, {int seconds = 30}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
  fail('Timed out waiting for: $what. The screen shows: $texts');
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('roles after a restart, upload, playlists, favourites, devices and score settings against the real server', (tester) async {
    // sign in, then start the app services again as after a restart: only the token is known
    final first = await AppServices.create();
    await first.auth.signOut();
    await first.serverUrl.set(serverUrl);
    final login = await first.api.auth.login(LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_IOS));
    await first.auth.signIn(login.auth);
    first.state.dispose();
    final services = await AppServices.create();
    expect(services.auth.signedIn, isTrue);
    await until(tester, () => services.auth.user != null, 'the user to be loaded after the restart');
    expect(services.auth.user!.uploader, isTrue);

    Widget app(Widget home) => AppRoot(services: services, child: MaterialApp(home: home));

    // 1. the menu offers Upload to an uploader
    await tester.pumpWidget(app(const MeScreen()));
    expect(find.text('Upload songs'), findsOneWidget);

    // 2. upload one song and a ZIP of songs: each is added, one after the other
    final before = (await services.api.catalog.searchSongs(SearchSongsRequest())).songs.length;
    final files = [DiskFile(uploadKar), DiskFile(uploadZip)];
    await tester.pumpWidget(app(UploadScreen(pick: () async => files)));
    await tester.tap(find.text('Choose files'));
    await until(tester, () => find.text('Choose files').evaluate().isNotEmpty && shows('added'), 'the uploads to finish', seconds: 60);
    expect(shows('Rejected'), isFalse, reason: 'nothing may be rejected');
    expect(find.text('Added'), findsWidgets);
    final after = (await services.api.catalog.searchSongs(SearchSongsRequest())).songs.length;
    expect(after, greaterThan(before));

    // 3. a playlist: create it on the screen, put songs in it, reorder and queue it
    await tester.pumpWidget(app(const PlaylistsScreen()));
    await tester.enterText(find.byKey(const Key('new-playlist')), 'Road trip');
    await tester.tap(find.text('Create'));
    await until(tester, () => find.text('Road trip').evaluate().isNotEmpty, 'the new playlist');
    final lists = await services.api.userLibrary.listPlaylists(ListPlaylistsRequest());
    final id = lists.playlists.firstWhere((p) => p.name == 'Road trip').id;
    await services.api.userLibrary.updatePlaylist(UpdatePlaylistRequest(id: id, replaceNumbers: true, numbers: ['00001', '00002', '00003']));
    await tester.pumpWidget(app(PlaylistDetailScreen(id: id, name: 'Road trip')));
    await until(tester, () => find.text('Title 3').evaluate().isNotEmpty, 'the playlist songs');
    await tester.tap(find.byTooltip('Move Title 1 down'));
    await until(tester, () => find.byTooltip('Move Title 1 up').evaluate().isNotEmpty, 'the move to be saved');
    final order = (await services.api.userLibrary.getPlaylist(GetPlaylistRequest(id: id))).playlist.songs.map((s) => s.number).toList();
    expect(order, ['00002', '00001', '00003']);
    await tester.tap(find.text('Add all to queue'));
    await until(tester, () => shows('Added 3 songs to the queue'), 'the queue message');

    // 4. favourites: a starred song is listed, un-starring removes it
    await services.api.userLibrary.setFavourite(SetFavouriteRequest(number: '00002', favourite: true));
    await tester.pumpWidget(app(const FavouritesScreen()));
    await until(tester, () => find.text('Title 2').evaluate().isNotEmpty, 'the favourite');
    await tester.tap(find.byTooltip('Favourite: Title 2'));
    await until(tester, () => find.text('Title 2').evaluate().isEmpty, 'the song to leave the list');

    // 5. devices: this device is listed; the MIDI mode is saved on the server
    await tester.pumpWidget(app(const MyDevicesScreen()));
    await until(tester, () => shows('(this device)'), 'the device list');
    await tester.tap(find.byKey(Key('mode-${services.auth.deviceId}')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Low power').last);
    await until(tester, () => shows('Lighter on a weak device'), 'the mode to be saved');
    final mine = (await services.api.auth.listMyDevices(ListMyDevicesRequest())).devices.firstWhere((d) => d.isCaller);
    expect(mine.midiMode, MidiMode.MIDI_MODE_LOW_POWER);

    // 6. score settings: Off is saved and arrives through the real state stream
    await until(tester, () => services.state.connected, 'the state stream');
    await tester.pumpWidget(app(const ScoreSettingsScreen()));
    await tester.tap(find.text('Off'));
    await until(tester, () => services.state.state?.settings.scoreMode == ScoreMode.SCORE_MODE_OFF, 'the score mode from the stream');

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
