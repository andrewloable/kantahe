import 'package:flutter/material.dart';

/// Shows a message at the bottom of the screen; [error] marks a failure, [actionLabel] and [onAction] add a button.
void showMessage(BuildContext context, String message, {bool error = false, String? actionLabel, VoidCallback? onAction}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
      action: actionLabel == null ? null : SnackBarAction(label: actionLabel, onPressed: onAction ?? () {}),
      // A SnackBar with an action stays until the action is used unless told otherwise, and a remote cannot dismiss it: it goes away by itself.
      persist: false,
      duration: actionLabel == null ? const Duration(seconds: 4) : const Duration(seconds: 8),
    ),
  );
}
