import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:connectrpc/connect.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/admin.pb.dart';
import 'package:kantahe/gen/kantahe/v1/upload.pb.dart';
import 'package:kantahe/upload/zip_songs.dart';

const _mb = 1024 * 1024;
const _defaultMaxBytes = 50 * _mb;

/// A file the user chose.
abstract interface class PickedFile {
  String get name;
  int get size;
  Future<Uint8List> readAll();

  /// For ZIP files: the archive is read from here as it is unpacked, not all at once.
  Future<InputStream> openStream();
}

/// Lets the user choose song files and ZIP files on the device.
Future<List<PickedFile>> pickSongFiles() async {
  final files = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['kar', 'karmp3', 'zip']);
  return [for (final f in files) _DeviceFile(f, await f.length() ?? 0)];
}

class _DeviceFile implements PickedFile {
  _DeviceFile(this._file, this.size);

  final PlatformFile _file;

  @override
  final int size;

  @override
  String get name => _file.name;

  @override
  Future<Uint8List> readAll() => _file.readAsBytes();

  @override
  Future<InputStream> openStream() async {
    final path = _file.path;
    if (path != null && await File(path).exists()) return InputFileStream(path);
    return InputMemoryStream(await _file.readAsBytes());
  }
}

class _Row {
  const _Row(this.name, this.result, [this.detail = '']);

  final String name;
  final String result;
  final String detail;
}

/// Adds songs to the library: songs and ZIP files of songs are sent one by one. ZIP files are unpacked on
/// this device and never sent. Only for users with the uploader role (and administrators).
class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key, this.pick = pickSongFiles});

  final Future<List<PickedFile>> Function() pick;

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  final List<_Row> _rows = [];
  bool _busy = false;
  bool _cancelled = false;
  bool _gone = false;
  int _maxBytes = _defaultMaxBytes;
  int _total = 0;
  bool _bound = false;

  late final AppServices _services = AppScope.of(context);

  bool get _allowed => _services.auth.user?.uploader == true || _services.auth.user?.admin == true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bound) return;
    _bound = true;
    // an administrator is held to the limit the server has set; others to the default
    if (_services.auth.user?.admin == true) {
      _services.api.admin
          .getServerSettings(GetServerSettingsRequest())
          .then((r) {
            if (!_gone && r.hasSettings()) setState(() => _maxBytes = r.settings.maxUploadBytes.toInt());
          })
          .catchError((Object _) {});
    }
  }

  @override
  void dispose() {
    _gone = true; // leaving the screen ends the upload: nothing goes on in the background
    super.dispose();
  }

  int get _limitMb => (_maxBytes / _mb).round().clamp(1, 1 << 30);

  int _add(_Row row) {
    if (_gone) return -1;
    setState(() => _rows.add(row));
    return _rows.length - 1;
  }

  void _set(int at, _Row row) {
    if (!_gone && at >= 0) setState(() => _rows[at] = row);
  }

  Future<void> _choose() async {
    if (_busy) return;
    final files = await widget.pick();
    if (files.isEmpty || _gone) return;
    setState(() {
      _busy = true;
      _cancelled = false;
      _rows.clear();
      _total = files.length;
    });
    try {
      for (final file in files) {
        if (_gone) return;
        if (_cancelled) {
          _add(_Row(file.name, 'Not sent', 'Cancelled'));
          continue;
        }
        final ext = file.name.split('.').last.toLowerCase();
        if (ext == 'zip') {
          await _fromZip(file);
        } else if (ext == 'kar' || ext == 'karmp3') {
          await _send(file.name, file.name, file.size, file.readAll);
        } else {
          _add(_Row(file.name, 'Rejected', 'Only .kar, .karmp3 and .zip files can be uploaded.'));
        }
      }
    } finally {
      if (!_gone) setState(() => _busy = false);
    }
  }

  Future<void> _fromZip(PickedFile zip) async {
    var found = 0;
    try {
      await for (final entry in extractSongs(await zip.openStream(), maxEntryBytes: _maxBytes)) {
        if (_gone) return;
        if (_cancelled) {
          _add(_Row(zip.name, 'Not sent', 'Cancelled'));
          return;
        }
        found++;
        if (found > 1) setState(() => _total++); // the ZIP itself counted as the first song
        await _send('${zip.name}: ${entry.name}', entry.name, entry.tooLarge ? _maxBytes + 1 : entry.bytes.length, () async => entry.bytes);
      }
    } on ZipError catch (e) {
      _add(_Row(zip.name, 'Rejected', e.message));
      return;
    }
    if (found == 0) _add(_Row(zip.name, 'Rejected', 'No songs found in this ZIP file.'));
  }

  Future<void> _send(String label, String filename, int size, Future<Uint8List> Function() content) async {
    if (size > _maxBytes) {
      _add(_Row(label, 'Rejected', 'Larger than the limit of $_limitMb MB.'));
      return;
    }
    final at = _add(_Row(label, 'Sending…'));
    try {
      final res = await _services.api.upload.uploadSong(UploadSongRequest(filename: filename, content: await content()));
      switch (res.status) {
        case UploadStatus.UPLOAD_STATUS_ADDED:
          _set(at, _Row(label, 'Added', res.song.number));
        case UploadStatus.UPLOAD_STATUS_DUPLICATE:
          _set(at, _Row(label, 'Duplicate', res.song.number));
        default:
          _set(at, _Row(label, 'Rejected', res.reason.isEmpty ? 'The server did not accept this file.' : res.reason));
      }
    } catch (e) {
      _set(at, _Row(label, 'Rejected', problem(e, {Code.permissionDenied: fromServer, Code.failedPrecondition: fromServer})));
    }
  }

  String get _summary {
    int count(String r) => _rows.where((x) => x.result == r).length;
    return '${count('Added')} added, ${count('Duplicate')} duplicates, ${count('Rejected')} rejected';
  }

  @override
  Widget build(BuildContext context) {
    final done = _rows.where((r) => r.result != 'Sending…').length;
    return Scaffold(
      appBar: AppBar(title: const Text('Upload songs')),
      body: !_allowed
          ? const Padding(padding: EdgeInsets.all(16), child: Text('Only users with the uploader role can add songs.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Choose .kar or .karmp3 files, or ZIP files of them. Each file may be up to $_limitMb MB.'),
                const SizedBox(height: 12),
                if (_busy)
                  Row(
                    children: [
                      Expanded(child: Text('Sent $done of $_total')),
                      OutlinedButton(onPressed: () => setState(() => _cancelled = true), child: const Text('Cancel')),
                    ],
                  )
                else
                  FilledButton(onPressed: _choose, child: const Text('Choose files')),
                if (_rows.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(_summary, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                for (final r in _rows) ListTile(dense: true, title: Text(r.name), subtitle: r.detail.isEmpty ? null : Text(r.detail), trailing: Text(r.result)),
              ],
            ),
    );
  }
}
