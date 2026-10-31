import 'dart:io';

import 'package:connectrpc/connect.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/errors.dart';

void main() {
  test('a code the screen maps shows the screen\'s text', () {
    expect(problem(ConnectException(Code.unauthenticated, 'x'), {Code.unauthenticated: 'Invalid email or password'}), 'Invalid email or password');
  });

  test('fromServer shows the text the server sent', () {
    expect(problem(ConnectException(Code.resourceExhausted, 'try again in 2 s'), {Code.resourceExhausted: fromServer}), 'try again in 2 s');
  });

  test('an invalid-argument error always shows the server text', () {
    expect(problem(ConnectException(Code.invalidArgument, 'email is too long'), {}), 'email is too long');
  });

  test('an unreachable server gets the connection sentence', () {
    const sentence = 'Could not reach the server. Check the connection and try again.';
    for (final c in [Code.unavailable, Code.unknown, Code.deadlineExceeded]) {
      expect(problem(ConnectException(c, 'x'), {}), sentence, reason: '$c');
    }
    expect(problem(const SocketException('no route'), {}), sentence);
  });

  test('anything else gets the general sentence', () {
    expect(problem(ConnectException(Code.internal, 'boom'), {}), 'Something went wrong. Try again.');
    expect(problem(ConnectException(Code.permissionDenied, 'no'), {}), 'Something went wrong. Try again.');
  });
}
