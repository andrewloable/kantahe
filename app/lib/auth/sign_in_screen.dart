import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/auth/auth_page.dart';
import 'package:kantahe/auth/device_info.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/tv/dpad_escape.dart';

/// Email and password; the device gets a name that shows in the user's device list.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key, this.deviceName, this.deviceType});

  /// Where the default device name comes from (the phone's model unless a test says otherwise).
  final Future<String> Function()? deviceName;

  /// The type to report (the platform's unless a test says otherwise).
  final DeviceType? deviceType;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _device = TextEditingController();
  bool _busy = false;
  bool _submitted = false;
  String _failure = '';

  @override
  void initState() {
    super.initState();
    (widget.deviceName ?? currentDeviceName)().then((name) {
      if (mounted && _device.text.isEmpty) _device.text = name;
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _device.dispose();
    super.dispose();
  }

  String? get _emailError => _submitted && _email.text.trim().isEmpty ? 'Enter your email address.' : null;
  String? get _passwordError => _submitted && _password.text.isEmpty ? 'Enter your password.' : null;
  String? get _deviceError => _submitted && _device.text.trim().isEmpty ? 'Enter a name for this device.' : null;

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _submitted = true;
      _failure = '';
    });
    if (_emailError != null || _passwordError != null || _deviceError != null) return;
    setState(() => _busy = true);
    final services = AppScope.of(context);
    try {
      final res = await services.api.auth.login(
        LoginRequest(
          email: _email.text.trim(),
          password: _password.text,
          deviceName: _device.text.trim(),
          deviceType: widget.deviceType ?? currentDeviceType(),
        ),
      );
      if (!res.hasAuth()) throw StateError('empty reply');
      TextInput.finishAutofillContext(); // lets the platform offer to save this login (a refused one leaves the group open for the retry)
      await services.auth.signIn(res.auth); // the app moves on by itself (change-password or the app)
      if (!mounted) return;
      setState(() {
        _password.clear();
        _submitted = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _password.clear();
        _submitted = false; // the emptied password is not a mistake to flag
        _failure = problem(e, {
          Code.unauthenticated: 'Invalid email or password',
          Code.resourceExhausted: fromServer,
          Code.permissionDenied: 'This account is disabled.',
        });
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    return AuthPage(
      title: 'Sign in',
      children: [
        ListenableBuilder(listenable: services.serverUrl, builder: (context, _) => Text('Server: ${services.serverUrl.value ?? ''}')),
        TextButton(onPressed: services.serverUrl.clear, child: const Text('Use another server')),
        const SizedBox(height: 8),
        AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DpadEscape(
                controller: _email,
                builder: (focus, readOnly) => TextField(
                  focusNode: focus,
                  readOnly: readOnly,
                  key: const Key('email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.username],
                  autocorrect: false,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(labelText: 'Email', errorText: _emailError, border: const OutlineInputBorder()),
                ),
              ),
              const SizedBox(height: 12),
              DpadEscape(
                controller: _password,
                builder: (focus, readOnly) => TextField(
                  focusNode: focus,
                  readOnly: readOnly,
                  key: const Key('password'),
                  controller: _password,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(labelText: 'Password', errorText: _passwordError, border: const OutlineInputBorder()),
                ),
              ),
              const SizedBox(height: 12),
              DpadEscape(
                controller: _device,
                builder: (focus, readOnly) => TextField(
                  focusNode: focus,
                  readOnly: readOnly,
                  key: const Key('device-name'),
                  controller: _device,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  maxLength: 100,
                  decoration: InputDecoration(labelText: 'Device name', errorText: _deviceError, counterText: '', border: const OutlineInputBorder()),
                ),
              ),
            ],
          ),
        ),
        if (_failure.isNotEmpty) MessageLine(_failure),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _submit, child: const Text('Sign in')),
      ],
    );
  }
}
