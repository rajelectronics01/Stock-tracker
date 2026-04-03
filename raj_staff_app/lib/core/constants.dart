// ─────────────────────────────────────────────────────────────────────────────
//  constants.dart  –  Supabase credentials for the Flutter staff app
//
//  The URL and anon key below must match your Supabase project's API settings.
//  They are also used server-side by the Next.js web app via .env.local.
//  These are ANON (public) keys – they only grant what your RLS policies allow.
// ─────────────────────────────────────────────────────────────────────────────

class ApiConstants {
  /// Your Supabase project URL (same as NEXT_PUBLIC_SUPABASE_URL in .env.local)
  static const String supabaseUrl = 'https://plqmhnkmiagzclnqwpet.supabase.co';

  /// Supabase anonymous/public key – safe to ship in client apps per Supabase docs.
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscW1obmttaWFnemNsbnF3cGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTA2NzUsImV4cCI6MjA5MDQ2NjY3NX0'
      '.58r7emvlcjmTz0fsWum6LTB7c6NMGU8xOnwmY1VtayE';
}

class AppConstants {
  static const String companyName = 'RAJ ELECTRONICS';
  static const String staffAppTitle = 'Staff Portal';

  /// The name of the DB table used for custom staff login.
  static const String employeesTable = 'employees';

  /// Column names used when authenticating staff.
  static const String empIdColumn = 'emp_id';
  static const String empNameColumn = 'name';
}
