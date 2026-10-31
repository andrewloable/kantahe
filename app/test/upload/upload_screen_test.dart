import 'dart:async';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:fixnum/fixnum.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/admin.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/admin.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/upload.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/upload.pb.dart';
import 'package:kantahe/upload/upload_screen.dart';

class Picked implements PickedFile {
  Picked(this.name, this.bytes, {int? size}) : size = size ?? bytes.length;

  @override
  final String name;
  final Uint8List bytes;
  @override
  final int size;

  @override
  Future<Uint8List> readAll() async => bytes;

  @override
  Future<InputStream> openStream() async => InputMemoryStream(bytes);
}

Uint8List zipOf(Map<String, List<int>> files) {
  final a = Archive();
  for (final e in files.entries) {
    a.add(ArchiveFile.bytes(e.key, e.value));
  }
  return Uint8List.fromList(ZipEncoder().encode(a));
}

class Rig {
  final sent = <({String filename, int length})>[];
  final sentBytes = <Uint8List>[];
  int running = 0;
  int maxRunning = 0;
  FutureOr<UploadSongResponse> Function(UploadSongRequest req)? onUpload;
  int settingsAsked = 0;
  int limitBytes = 50 * 1024 * 1024;
  late final AppServices services;
  late final AuthStore auth;

  Future<void> start({bool uploader = true, bool admin = false}) async {
    auth = AuthStore(MemoryStore());
    await auth.signIn(
      AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u', uploader: uploader, admin: admin),
      ),
    );
    final api = Api(
      FakeTransportBuilder()
          .unary(UploadService.uploadSong, (req, ctx) async {
            running++;
            if (running > maxRunning) maxRunning = running;
            sent.add((filename: req.filename, length: req.content.length));
            sentBytes.add(Uint8List.fromList(req.content));
            try {
              return await (onUpload?.call(req) ??
                  UploadSongResponse(
                    status: UploadStatus.UPLOAD_STATUS_ADDED,
                    song: Song(number: '00123'),
                  ));
            } finally {
              running--;
            }
          })
          .unary(AdminService.getServerSettings, (req, ctx) async {
            settingsAsked++;
            return GetServerSettingsResponse(settings: ServerSettings(maxUploadBytes: Int64(limitBytes)));
          })
          .build(),
    );
    services = AppServices(
      serverUrl: ServerUrl(MemoryStore()),
      auth: auth,
      api: api,
      state: StateStore(client: api.session, auth: AuthStore(MemoryStore())),
    );
  }

  Future<void> open(WidgetTester tester, List<PickedFile> Function() pick) async {
    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: MaterialApp(home: UploadScreen(pick: () async => pick())),
      ),
    );
    await tester.pump();
  }
}

Future<void> choose(WidgetTester tester) async {
  await tester.tap(find.text('Choose files'));
  await tester.pump();
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 5));
  }
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

void main() {
  testWidgets('uploads one file after the other, never two at once', (tester) async {
    final r = Rig();
    await r.start();
    final gate = Completer<void>();
    r.onUpload = (req) async {
      if (req.filename == 'a.kar') await gate.future;
      return UploadSongResponse(
        status: UploadStatus.UPLOAD_STATUS_ADDED,
        song: Song(number: '1'),
      );
    };
    await r.open(
      tester,
      () => [
        Picked('a.kar', Uint8List.fromList([1])),
        Picked('b.kar', Uint8List.fromList([2])),
        Picked('c.karmp3', Uint8List.fromList([3])),
      ],
    );
    await choose(tester);
    await settle(tester);
    expect(r.sent.map((s) => s.filename), ['a.kar']); // b waits for a
    gate.complete();
    await settle(tester);
    expect(r.sent.map((s) => s.filename), ['a.kar', 'b.kar', 'c.karmp3']);
    expect(r.maxRunning, 1);
  });

  testWidgets('reports every file: added, duplicate, rejected with the reason, a failed call', (tester) async {
    final r = Rig();
    await r.start();
    r.onUpload = (req) {
      switch (req.filename) {
        case 'new.kar':
          return UploadSongResponse(
            status: UploadStatus.UPLOAD_STATUS_ADDED,
            song: Song(number: '00042'),
          );
        case 'twin.kar':
          return UploadSongResponse(
            status: UploadStatus.UPLOAD_STATUS_DUPLICATE,
            song: Song(number: '00007'),
          );
        case 'bad.kar':
          return UploadSongResponse(status: UploadStatus.UPLOAD_STATUS_REJECTED, reason: 'not a MIDI file');
        case 'empty.kar':
          return UploadSongResponse(status: UploadStatus.UPLOAD_STATUS_REJECTED);
        default:
          throw ConnectException(Code.permissionDenied, 'you may not upload');
      }
    };
    await r.open(
      tester,
      () => [
        for (final n in ['new.kar', 'twin.kar', 'bad.kar', 'empty.kar', 'denied.kar']) Picked(n, Uint8List.fromList([1])),
      ],
    );
    await choose(tester);
    await settle(tester);
    expect(shows('00042'), isTrue);
    expect(shows('00007'), isTrue);
    expect(shows('not a MIDI file'), isTrue);
    expect(shows('The server did not accept this file.'), isTrue);
    expect(shows('you may not upload'), isTrue);
    expect(shows('1 added, 1 duplicates, 3 rejected'), isTrue);
  });

  testWidgets('a file over the limit is rejected here and never sent', (tester) async {
    final r = Rig();
    await r.start();
    await r.open(
      tester,
      () => [
        Picked('huge.kar', Uint8List(1), size: 51 * 1024 * 1024),
        Picked('ok.kar', Uint8List.fromList([1])),
      ],
    );
    await choose(tester);
    await settle(tester);
    expect(r.sent.map((s) => s.filename), ['ok.kar']);
    expect(shows('Larger than the limit of 50 MB.'), isTrue);
  });

  testWidgets('a file that is not a song or a ZIP is rejected here', (tester) async {
    final r = Rig();
    await r.start();
    await r.open(
      tester,
      () => [
        Picked('notes.txt', Uint8List.fromList([1])),
        Picked('song.mid', Uint8List.fromList([1])),
      ],
    );
    await choose(tester);
    await settle(tester);
    expect(r.sent, isEmpty);
    expect(find.text('Only .kar, .karmp3 and .zip files can be uploaded.'), findsNWidgets(2));
  });

  group('ZIP files', () {
    testWidgets('only the songs inside are sent, one by one, never the ZIP itself', (tester) async {
      final r = Rig();
      await r.start();
      final zip = zipOf({
        'one.kar': [1, 2],
        'readme.txt': [9],
        'sub/two.karmp3': [3],
      });
      await r.open(tester, () => [Picked('pack.zip', zip)]);
      await choose(tester);
      await settle(tester);
      expect(r.sent.map((s) => s.filename), ['one.kar', 'two.karmp3']);
      expect(r.sentBytes.map((b) => b.toList()), [
        [1, 2],
        [3],
      ]);
      expect(shows('pack.zip: one.kar'), isTrue);
      expect(shows('pack.zip: two.karmp3'), isTrue);
      expect(r.sentBytes.any((b) => b.length == zip.length), isFalse);
    });

    testWidgets('a ZIP without songs says so', (tester) async {
      final r = Rig();
      await r.start();
      await r.open(
        tester,
        () => [
          Picked(
            'empty.zip',
            zipOf({
              'a.txt': [1],
            }),
          ),
        ],
      );
      await choose(tester);
      await settle(tester);
      expect(r.sent, isEmpty);
      expect(shows('No songs found in this ZIP file.'), isTrue);
    });

    testWidgets('a damaged ZIP is rejected with the sentence', (tester) async {
      final r = Rig();
      await r.start();
      await r.open(
        tester,
        () => [
          Picked('bad.zip', Uint8List.fromList([1, 2, 3, 4, 5, 6, 7, 8])),
        ],
      );
      await choose(tester);
      await settle(tester);
      expect(shows('damaged or incomplete'), isTrue);
    });

    testWidgets('a song in a ZIP over the limit is rejected without being sent, the next one goes on', (tester) async {
      final r = Rig();
      await r.start(admin: true);
      r.limitBytes = 100;
      await r.open(
        tester,
        () => [
          Picked(
            'pack.zip',
            zipOf({
              'big.kar': List.filled(500, 1),
              'small.kar': [1],
            }),
          ),
        ],
      );
      await tester.pump();
      await settle(tester);
      await choose(tester);
      await settle(tester);
      expect(r.sent.map((s) => s.filename), ['small.kar']);
      expect(shows('Larger than the limit of 1 MB.'), isTrue);
    });
  });

  testWidgets('Cancel stops after the file that is being sent; the rest is reported as not sent', (tester) async {
    final r = Rig();
    await r.start();
    final gate = Completer<void>();
    r.onUpload = (req) async {
      if (req.filename == 'a.kar') await gate.future;
      return UploadSongResponse(
        status: UploadStatus.UPLOAD_STATUS_ADDED,
        song: Song(number: '1'),
      );
    };
    await r.open(
      tester,
      () => [
        Picked('a.kar', Uint8List.fromList([1])),
        Picked('b.kar', Uint8List.fromList([2])),
      ],
    );
    await choose(tester);
    await settle(tester);
    await tester.tap(find.text('Cancel'));
    await tester.pump();
    gate.complete();
    await settle(tester);
    expect(r.sent.map((s) => s.filename), ['a.kar']);
    expect(shows('Cancelled'), isTrue);
    expect(find.text('Choose files'), findsOneWidget); // ready for the next time
  });

  testWidgets('leaving the screen ends the upload', (tester) async {
    final r = Rig();
    await r.start();
    final gate = Completer<void>();
    r.onUpload = (req) async {
      if (req.filename == 'a.kar') await gate.future;
      return UploadSongResponse(
        status: UploadStatus.UPLOAD_STATUS_ADDED,
        song: Song(number: '1'),
      );
    };
    await r.open(
      tester,
      () => [
        Picked('a.kar', Uint8List.fromList([1])),
        Picked('b.kar', Uint8List.fromList([2])),
      ],
    );
    await choose(tester);
    await settle(tester);
    await tester.pumpWidget(const SizedBox());
    gate.complete();
    await settle(tester);
    expect(r.sent.map((s) => s.filename), ['a.kar']);
  });

  testWidgets('while files are being sent the chooser is off', (tester) async {
    final r = Rig();
    await r.start();
    final gate = Completer<void>();
    r.onUpload = (req) async {
      await gate.future;
      return UploadSongResponse(
        status: UploadStatus.UPLOAD_STATUS_ADDED,
        song: Song(number: '1'),
      );
    };
    await r.open(
      tester,
      () => [
        Picked('a.kar', Uint8List.fromList([1])),
      ],
    );
    await choose(tester);
    await settle(tester);
    expect(find.text('Choose files'), findsNothing);
    gate.complete();
    await settle(tester);
    expect(find.text('Choose files'), findsOneWidget);
  });

  testWidgets('nothing chosen sends nothing', (tester) async {
    final r = Rig();
    await r.start();
    await r.open(tester, () => []);
    await choose(tester);
    await settle(tester);
    expect(r.sent, isEmpty);
    expect(find.text('Choose files'), findsOneWidget);
  });

  group('who may upload', () {
    testWidgets('a user without the uploader role cannot use the screen', (tester) async {
      final r = Rig();
      await r.start(uploader: false);
      await r.open(tester, () => []);
      expect(find.text('Choose files'), findsNothing);
      expect(shows('uploader role'), isTrue);
    });

    testWidgets('an uploader can, and does not ask the server for its limit', (tester) async {
      final r = Rig();
      await r.start();
      await r.open(tester, () => []);
      expect(find.text('Choose files'), findsOneWidget);
      expect(r.settingsAsked, 0);
    });

    testWidgets('an administrator can, and is held to the limit the server has set', (tester) async {
      final r = Rig();
      await r.start(uploader: false, admin: true);
      r.limitBytes = 3 * 1024 * 1024;
      await r.open(tester, () => [Picked('four.kar', Uint8List(1), size: 4 * 1024 * 1024)]);
      await tester.pump();
      await settle(tester);
      await choose(tester);
      await settle(tester);
      expect(r.settingsAsked, 1);
      expect(r.sent, isEmpty);
      expect(shows('Larger than the limit of 3 MB.'), isTrue);
    });
  });
}
