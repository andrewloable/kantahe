import 'package:flutter/material.dart';

void main() {
  runApp(const KantaheApp());
}

class KantaheApp extends StatelessWidget {
  const KantaheApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Kantahe',
      home: Scaffold(body: Center(child: Text('Kantahe'))),
    );
  }
}
