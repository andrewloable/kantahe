import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:kantahe/auth/auth_page.dart' show MessageLine;
import 'package:kantahe/auth/device_info.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:qr_flutter/qr_flutter.dart';

enum _Phase { starting, waiting, expired, failed }

const _firstRetry = Duration(seconds: 1);
const _maxRetry = Duration(seconds: 10);

/// Signs a TV in without typing: it shows a code and a QR of the approval address, and keeps
/// AuthService.WaitCodeLogin open until someone approves the code on a phone or in a browser.
class CodeSignInScreen extends StatefulWidget {
  const CodeSignInScreen({super.key, this.deviceName});

  /// The name shown in the user's device list (tests give a fixed one).
  final Future<String> Function()? deviceName;

  @override
  State<CodeSignInScreen> createState() => _CodeSignInScreenState();
}

class _CodeSignInScreenState extends State<CodeSignInScreen> {
  _Phase _phase = _Phase.starting;
  String _failure = '';
  StartCodeLoginResponse? _login;
  bool _disposed = false;
  int _round = 0; // a new code ends the wait of the old one
  final _stops = <void Function()>[];

  late final AppServices _services;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _services = AppScope.of(context);
    unawaited(_start());
  }

  @override
  void dispose() {
    _disposed = true;
    for (final stop in List.of(_stops)) {
      stop();
    }
    super.dispose();
  }

  Future<void> _start() async {
    final round = ++_round;
    for (final stop in List.of(_stops)) {
      stop();
    }
    // the first call runs before the first build, so there is nothing to rebuild yet
    void reset() {
      _phase = _Phase.starting;
      _failure = '';
      _login = null;
    }

    _round == 1 ? reset() : setState(reset);
    final services = _services;
    try {
      final name = await (widget.deviceName ?? () => currentDeviceName(tv: true))();
      final res = await services.api.auth.startCodeLogin(StartCodeLoginRequest(deviceName: name, deviceType: DeviceType.DEVICE_TYPE_ANDROID_TV));
      if (_disposed || round != _round) return;
      setState(() {
        _login = res;
        _phase = _Phase.waiting;
      });
      unawaited(_wait(res.loginId, round));
    } catch (e) {
      if (_disposed || round != _round) return;
      setState(() {
        _failure = problem(e, const {});
        _phase = _Phase.failed;
      });
    }
  }

  /// Keeps one wait open; when it drops while the code may still be valid it is opened again with the same
  /// secret, until the server answers approved or expired.
  Future<void> _wait(String loginId, int round) async {
    final services = _services;
    var delay = _firstRetry;
    while (!_disposed && round == _round) {
      final attempt = CancelableSignal();
      final done = Completer<void>();
      void finish() {
        if (!done.isCompleted) done.complete();
      }

      _stops.add(finish);
      _stops.add(attempt.cancel);
      var answered = false;
      Object? failure;
      services.api.auth
          .waitCodeLogin(WaitCodeLoginRequest(loginId: loginId), signal: attempt)
          .listen(
            (msg) {
              if (_disposed || round != _round || answered) return;
              if (msg.hasApproved()) {
                answered = true;
                unawaited(services.auth.signIn(msg.approved));
                finish();
              } else if (msg.hasExpired() && msg.expired) {
                answered = true;
                setState(() => _phase = _Phase.expired);
                finish();
              }
            },
            // a stream that drops is opened again; what the server answers with is looked at below
            onError: (Object e) {
              failure = e;
              finish();
            },
            onDone: finish,
            cancelOnError: true,
          );
      await done.future;
      // The subscription stays so that the "canceled" error of an aborted request has a listener.
      attempt.cancel();
      _stops.remove(finish);
      _stops.remove(attempt.cancel);
      if (answered || _disposed || round != _round) return;
      final e = failure;
      if (e is ConnectException && e.code == Code.notFound) {
        // the server no longer knows this login (it restarted, or purged it after it expired): it is an expired code
        setState(() => _phase = _Phase.expired);
        return;
      }
      if (e is ConnectException && e.code == Code.permissionDenied) {
        // for instance a disabled account: waiting longer cannot help
        setState(() {
          _failure = problem(e, const {Code.permissionDenied: fromServer});
          _phase = _Phase.failed;
        });
        return;
      }
      await _sleep(delay);
      delay = delay * 2 > _maxRetry ? _maxRetry : delay * 2;
    }
  }

  Future<void> _sleep(Duration d) {
    final c = Completer<void>();
    final timer = Timer(d, () => c.complete());
    void stop() {
      timer.cancel();
      if (!c.isCompleted) c.complete();
    }

    _stops.add(stop);
    return c.future.whenComplete(() => _stops.remove(stop));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final login = _login;
    final body = <Widget>[];
    switch (_phase) {
      case _Phase.starting:
        body.add(const CircularProgressIndicator());
      case _Phase.waiting:
        body.addAll([
          const Text('On your phone or computer, sign in to Kantahe and approve this code under "Approve a TV".', textAlign: TextAlign.center),
          const SizedBox(height: 24),
          // the code and its QR side by side: a TV screen is wide and not tall
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                login!.code,
                key: const Key('login-code'),
                style: theme.textTheme.displayLarge!.copyWith(fontSize: 72, fontWeight: FontWeight.bold, letterSpacing: 8),
              ),
              const SizedBox(width: 48),
              SizedBox(
                width: 200,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      color: Colors.white,
                      padding: const EdgeInsets.all(8),
                      child: QrImageView(key: ValueKey('qr:${login.approveUrl}'), data: login.approveUrl, size: 160, backgroundColor: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(login.approveUrl, style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
                  ],
                ),
              ),
            ],
          ),
        ]);
      case _Phase.expired:
        body.addAll([
          const Text('Code expired', textAlign: TextAlign.center, style: TextStyle(fontSize: 28)),
          const SizedBox(height: 24),
          FilledButton(autofocus: true, onPressed: _start, child: const Text('New code')),
        ]);
      case _Phase.failed:
        body.addAll([MessageLine(_failure), const SizedBox(height: 24), FilledButton(autofocus: true, onPressed: _start, child: const Text('Try again'))]);
    }
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Sign in to Kantahe', style: theme.textTheme.headlineMedium),
                  const SizedBox(height: 16),
                  ...body,
                  const SizedBox(height: 16),
                  TextButton(onPressed: () => _services.serverUrl.clear(), child: const Text('Use another server')),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
