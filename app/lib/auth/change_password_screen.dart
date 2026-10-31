import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/auth/auth_page.dart';
import 'package:kantahe/auth/form.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

/// Change the password. When the server insists (a temporary password), the app shows only this screen.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, this.onDone});

  /// What "Continue" does after a voluntary change (the screen is simply closed when it is null).
  final VoidCallback? onDone;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  bool _submitted = false;
  bool _done = false;
  String _failure = '';

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String? get _currentError => _submitted && _current.text.isEmpty ? 'Enter your current password.' : null;

  String? get _newError {
    if (!_submitted) return null;
    if (!passwordLengthOk(_new.text)) return 'The new password must be 8 to 256 characters.';
    if (_new.text == _current.text) return 'The new password must differ from the current one.';
    return null;
  }

  String? get _confirmError => _submitted && _newError == null && _new.text != _confirm.text ? 'The passwords do not match.' : null;

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _submitted = true;
      _failure = '';
    });
    if (_currentError != null || _newError != null || _confirmError != null) return;
    setState(() => _busy = true);
    final auth = AppScope.of(context);
    try {
      await auth.api.auth.changePassword(ChangePasswordRequest(currentPassword: _current.text, newPassword: _new.text));
      TextInput.finishAutofillContext(); // lets the platform offer to save the new password
      auth.auth.passwordChanged(); // when the server insisted, the app moves on by itself
      if (!mounted) return;
      setState(() {
        _current.clear();
        _new.clear();
        _confirm.clear();
        _done = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _failure = problem(e, {Code.permissionDenied: 'Current password is wrong.', Code.resourceExhausted: fromServer}));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String key, String label, TextEditingController c, String? error, {TextInputAction action = TextInputAction.next}) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextField(
      key: Key(key),
      controller: c,
      obscureText: true,
      autofillHints: [key == 'current' ? AutofillHints.password : AutofillHints.newPassword],
      textInputAction: action,
      onSubmitted: action == TextInputAction.done ? (_) => _submit() : null,
      decoration: InputDecoration(labelText: label, errorText: error, border: const OutlineInputBorder()),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    if (_done) {
      return AuthPage(
        title: 'Change password',
        children: [
          const Text('Password changed. Other devices were signed out.'),
          const SizedBox(height: 16),
          FilledButton(onPressed: widget.onDone ?? () => Navigator.of(context).maybePop(), child: const Text('Continue')),
        ],
      );
    }
    return AuthPage(
      title: 'Change password',
      children: [
        ListenableBuilder(
          listenable: services.auth,
          builder: (context, _) => services.auth.passwordChangeRequired
              ? const Padding(padding: EdgeInsets.only(bottom: 12), child: Text('Choose a new password to continue.'))
              : const SizedBox.shrink(),
        ),
        AutofillGroup(
          child: Column(
            children: [
              _field('current', 'Current password', _current, _currentError),
              _field('new', 'New password', _new, _newError),
              _field('confirm', 'Repeat the new password', _confirm, _confirmError, action: TextInputAction.done),
            ],
          ),
        ),
        if (_failure.isNotEmpty) MessageLine(_failure),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _submit, child: const Text('Change password')),
        ListenableBuilder(
          listenable: services.auth,
          builder: (context, _) =>
              services.auth.passwordChangeRequired ? TextButton(onPressed: services.auth.signOut, child: const Text('Sign out')) : const SizedBox.shrink(),
        ),
      ],
    );
  }
}
