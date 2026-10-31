import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

void main() {
  test('messages round-trip', () {
    final song = Song(number: '01052', format: Format.FORMAT_MP3);
    final back = Song.fromBuffer(song.writeToBuffer());
    expect(back.number, '01052');
    expect(back.format, Format.FORMAT_MP3);
  });
}
