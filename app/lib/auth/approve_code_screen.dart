import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/auth/auth_page.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/tv/dpad_escape.dart';

const _codeLength = 6;

/// Capitals only; spaces, dashes and other marks (as in "ab-c d12") are dropped.
final _capitals = TextInputFormatter.withFunction((old, value) {
  final clean = value.text.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
  final text = clean.length > _codeLength ? clean.substring(0, _codeLength) : clean;
  return TextEditingValue(
    text: text,
    selection: TextSelection.collapsed(offset: text.length),
  );
});

/// Sign a TV in with the code it shows.
class ApproveCodeScreen extends StatefulWidget {
  const ApproveCodeScreen({super.key});

  @override
  State<ApproveCodeScreen> createState() => _ApproveCodeScreenState();
}

class _ApproveCodeScreenState extends State<ApproveCodeScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String _failure = '';
  String _approved = '';

  @override
  void initState() {
    super.initState();
    _code.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  bool get _complete => _code.text.length == _codeLength;

  Future<void> _approve() async {
    if (_busy || !_complete) return;
    setState(() {
      _failure = '';
      _approved = '';
      _busy = true;
    });
    final api = AppScope.of(context).api;
    try {
      final res = await api.auth.approveCode(ApproveCodeRequest(code: _code.text));
      if (!mounted) return;
      setState(() {
        _approved = res.deviceName;
        _code.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _failure = problem(e, {Code.notFound: 'Code not found or expired', Code.resourceExhausted: fromServer}));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthPage(
      title: 'Approve a TV',
      children: [
        const Text('Enter the code shown on the TV to sign it in with your account.'),
        const SizedBox(height: 16),
        DpadEscape(
          controller: _code,
          builder: (focus, readOnly) => TextField(
            focusNode: focus,
            readOnly: readOnly,
            key: const Key('code'),
            controller: _code,
            maxLength: _codeLength,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [_capitals],
            style: const TextStyle(fontFamily: 'monospace', fontSize: 24, letterSpacing: 4),
            onSubmitted: (_) => _approve(),
            decoration: const InputDecoration(
              labelText: 'Code',
              counterText: '',
              helperText: 'Six characters: letters and the digits 2 to 9. A code never has 0, 1, I or O.',
              helperMaxLines: 2,
              border: OutlineInputBorder(),
            ),
          ),
        ),
        if (_failure.isNotEmpty) MessageLine(_failure),
        if (_approved.isNotEmpty) MessageLine('Signed in $_approved', error: false),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy || !_complete ? null : _approve, child: const Text('Approve')),
      ],
    );
  }
}
