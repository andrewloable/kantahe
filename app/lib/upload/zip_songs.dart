import 'dart:typed_data';

import 'package:archive/archive.dart';

/// At most this many entries (of any kind) in one ZIP file.
const maxZipEntries = 10000;

/// At most this much song data in one ZIP file.
const maxZipBytes = 2 * 1024 * 1024 * 1024;

/// A song of a ZIP file.
class ZipSong {
  const ZipSong(this.name, this.bytes, {this.tooLarge = false});

  /// The file name without its folders.
  final String name;
  final Uint8List bytes;

  /// The song is bigger than the per-song limit: it was not unpacked and [bytes] is empty.
  final bool tooLarge;
}

/// A ZIP file that cannot be used, with a sentence for the user.
class ZipError implements Exception {
  const ZipError(this.message);

  final String message;

  @override
  String toString() => message;
}

bool _isSong(String name) {
  final n = name.toLowerCase();
  return n.endsWith('.kar') || n.endsWith('.karmp3');
}

/// True when the data ends with a ZIP end-of-central-directory record (PK 05 06, within the last 64 KB plus
/// its length). The decoder itself answers "no entries" for cut-off or garbage data instead of an error.
bool _hasEndRecord(InputStream input) {
  final length = input.length;
  const window = 65535 + 22;
  final from = length > window ? length - window : 0;
  final tail = input.subset(position: from, length: length - from).toUint8List();
  for (var i = tail.length - 22; i >= 0; i--) {
    if (tail[i] == 0x50 && tail[i + 1] == 0x4b && tail[i + 2] == 0x05 && tail[i + 3] == 0x06) return true;
  }
  return false;
}

/// The song files of a ZIP, one at a time, unpacked only when asked for: a consumer that stops early never
/// unpacks the rest. Only .kar and .karmp3 files count (any folder, any case); an archive with more than
/// [maxEntries] entries or more than [maxBytes] of song data is refused. A song over [maxEntryBytes] is
/// reported as too large without being unpacked.
Stream<ZipSong> extractSongs(InputStream input, {int maxEntries = maxZipEntries, int maxBytes = maxZipBytes, int maxEntryBytes = 1 << 62}) async* {
  const damaged = ZipError('The ZIP file could not be read: it may be damaged or incomplete.');
  if (!_hasEndRecord(input)) throw damaged;
  final Archive archive;
  try {
    archive = ZipDecoder().decodeStream(input);
  } on Object {
    throw damaged;
  }
  if (archive.length > maxEntries) throw ZipError('The ZIP file has more than $maxEntries files.');
  var total = 0;
  for (final file in archive) {
    final name = file.name.split(RegExp(r'[/\\]')).last; // folders written with / or with \ (made on Windows)
    if (!file.isFile || !_isSong(name)) continue;
    total += file.size;
    if (total > maxBytes) throw const ZipError('The songs in the ZIP file are too large altogether.');
    if (file.size > maxEntryBytes) {
      yield ZipSong(name, Uint8List(0), tooLarge: true);
      continue;
    }
    final Uint8List? bytes;
    try {
      bytes = file.readBytes();
    } on Object {
      throw damaged;
    }
    file.clear(); // let go of the packed data too
    yield ZipSong(name, bytes ?? Uint8List(0));
    await Future<void>.delayed(Duration.zero); // lets the screen draw between two songs
  }
}
