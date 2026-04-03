import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/constants.dart';
import 'core/di.dart' as di;
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── 1. Initialise Supabase BEFORE anything else ──────────────────────────
  await Supabase.initialize(
    url: ApiConstants.supabaseUrl,
    anonKey: ApiConstants.supabaseAnonKey,
    debug: false, // set to true during development to see Supabase logs
  );

  // ── 2. Wire up dependency injection ──────────────────────────────────────
  await di.init();

  runApp(const RajStaffApp());
}
