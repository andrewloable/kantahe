import 'package:flutter/material.dart';
import 'package:kantahe/auth/approve_code_screen.dart';
import 'package:kantahe/auth/change_password_screen.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/me/favourites_screen.dart';
import 'package:kantahe/me/history_screen.dart';
import 'package:kantahe/me/my_devices_screen.dart';
import 'package:kantahe/me/playlists_screen.dart';
import 'package:kantahe/me/score_settings_screen.dart';
import 'package:kantahe/upload/upload_screen.dart';

/// The account menu: the user's own pages, uploading (for uploaders), signing a TV in, and signing out.
class MeScreen extends StatelessWidget {
  const MeScreen({super.key});

  void _open(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));

  /// Signs this device out on the server, then here; here even when the server cannot be reached.
  Future<void> _signOut(AppServices services) async {
    final id = services.auth.deviceId;
    try {
      if (id != null) await services.api.auth.revokeDevice(RevokeDeviceRequest(deviceId: id));
    } catch (_) {
      // signed out here all the same
    }
    await services.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    return ListenableBuilder(
      listenable: services.auth,
      builder: (context, _) {
        final user = services.auth.user;
        final mayUpload = user?.uploader == true || user?.admin == true;
        Widget tile(String title, IconData icon, VoidCallback onTap) => ListTile(leading: Icon(icon), title: Text(title), onTap: onTap);
        return Scaffold(
          appBar: AppBar(title: const Text('Me')),
          body: ListView(
            children: [
              tile('Favourites', Icons.star_border, () => _open(context, const FavouritesScreen())),
              tile('History', Icons.history, () => _open(context, const HistoryScreen())),
              tile('Playlists', Icons.queue_music, () => _open(context, const PlaylistsScreen())),
              tile('My devices', Icons.devices, () => _open(context, const MyDevicesScreen())),
              tile('Score', Icons.emoji_events_outlined, () => _open(context, const ScoreSettingsScreen())),
              tile('Change password', Icons.password, () => _open(context, const ChangePasswordScreen())),
              tile('Approve a TV', Icons.tv, () => _open(context, const ApproveCodeScreen())),
              if (mayUpload) tile('Upload songs', Icons.upload_file, () => _open(context, const UploadScreen())),
              const Divider(),
              tile('Sign out', Icons.logout, () => _signOut(services)),
            ],
          ),
        );
      },
    );
  }
}
