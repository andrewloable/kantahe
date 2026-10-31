import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/upload/zip_songs.dart';

Uint8List zipOf(Map<String, List<int>> files, {Iterable<String> folders = const []}) {
  final archive = Archive();
  for (final f in folders) {
    archive.add(ArchiveFile.directory(f));
  }
  for (final e in files.entries) {
    archive.add(ArchiveFile.bytes(e.key, e.value));
  }
  return Uint8List.fromList(ZipEncoder().encode(archive));
}

Future<List<ZipSong>> read(Uint8List zip, {int? maxEntries, int? maxBytes, int? maxEntryBytes}) => extractSongs(
  InputMemoryStream(zip),
  maxEntries: maxEntries ?? maxZipEntries,
  maxBytes: maxBytes ?? maxZipBytes,
  maxEntryBytes: maxEntryBytes ?? 1 << 40,
).toList();

void main() {
  test('only song files are yielded, in order, with their folders dropped', () async {
    final zip = zipOf(
      {
        'one.kar': [1, 2, 3],
        'readme.txt': [9],
        'folder/two.karmp3': [4, 5],
        'folder/inner/cover.jpg': [8],
        'three.kar': [6],
      },
      folders: ['folder/'],
    );
    final songs = await read(zip);
    expect(songs.map((s) => s.name), ['one.kar', 'two.karmp3', 'three.kar']);
    expect(songs.map((s) => s.bytes.toList()), [
      [1, 2, 3],
      [4, 5],
      [6],
    ]);
    expect(songs.any((s) => s.tooLarge), isFalse);
  });

  test('the extension is matched in any case; other music files are not songs', () async {
    final zip = zipOf({
      'A.KAR': [1],
      'b.KarMp3': [2],
      'c.mid': [3],
      'd.mp3': [4],
      'e.kar.txt': [5],
    });
    expect((await read(zip)).map((s) => s.name), ['A.KAR', 'b.KarMp3']);
  });

  test('regression: an entry whose folders are written with backslashes (some Windows tools) still gives the plain file name', () async {
    final zip = zipOf({
      'folder/sub/song.kar': [1],
      'plain/other.karmp3': [2],
    });
    // the encoder writes names with "/"; turn them into backslashes in the headers, as such tools do
    for (final name in ['folder/sub/song.kar', 'plain/other.karmp3']) {
      final from = name.codeUnits;
      final to = name.replaceAll('/', '\\').codeUnits;
      for (var i = 0; i + from.length <= zip.length; i++) {
        var same = true;
        for (var k = 0; k < from.length && same; k++) {
          same = zip[i + k] == from[k];
        }
        if (same) zip.setRange(i, i + to.length, to);
      }
    }
    expect((await read(zip)).map((s) => s.name), ['song.kar', 'other.karmp3']);
  });

  test('an archive without songs yields nothing', () async {
    expect(
      await read(
        zipOf({
          'a.txt': [1],
        }),
      ),
      isEmpty,
    );
  });

  test('entry limit error: more entries than allowed (every entry counts, songs or not)', () async {
    final zip = zipOf({
      'a.kar': [1],
      'b.txt': [2],
      'c.kar': [3],
      'd.txt': [4],
    });
    await expectLater(read(zip, maxEntries: 3), throwsA(isA<ZipError>().having((e) => e.message, 'message', 'The ZIP file has more than 3 files.')));
    expect((await read(zip, maxEntries: 4)).length, 2); // exactly at the limit is fine
  });

  test('the songs together may not be larger than the limit', () async {
    final zip = zipOf({'a.kar': List.filled(60, 1), 'b.kar': List.filled(60, 2)});
    await expectLater(
      read(zip, maxBytes: 100),
      throwsA(isA<ZipError>().having((e) => e.message, 'message', 'The songs in the ZIP file are too large altogether.')),
    );
    expect((await read(zip, maxBytes: 120)).length, 2);
  });

  test('a song over the per-song limit is reported as too large without its bytes', () async {
    final zip = zipOf({
      'small.kar': [1, 2],
      'big.kar': List.filled(500, 7),
      'after.kar': [3],
    });
    final songs = await read(zip, maxEntryBytes: 100);
    expect(songs.map((s) => s.name), ['small.kar', 'big.kar', 'after.kar']);
    expect(songs[1].tooLarge, isTrue);
    expect(songs[1].bytes, isEmpty);
    expect(songs[0].bytes.length, 2);
    expect(songs[2].bytes.length, 1); // unpacking goes on with the next song
  });

  test('a damaged or cut-off archive is an error with a sentence', () async {
    final zip = zipOf({'a.kar': List.filled(2000, 1), 'b.kar': List.filled(2000, 2)});
    final cut = Uint8List.sublistView(zip, 0, zip.length ~/ 2);
    await expectLater(read(cut), throwsA(isA<ZipError>().having((e) => e.message, 'message', contains('damaged or incomplete'))));
    await expectLater(read(Uint8List.fromList([1, 2, 3, 4, 5, 6, 7, 8])), throwsA(isA<ZipError>()));
  });

  test('the songs come one at a time (a consumer that stops early never unpacks the rest)', () async {
    final zip = zipOf({
      'a.kar': [1],
      'b.kar': [2],
      'c.kar': [3],
    });
    final first = await extractSongs(InputMemoryStream(zip)).first;
    expect(first.name, 'a.kar');
  });
}
