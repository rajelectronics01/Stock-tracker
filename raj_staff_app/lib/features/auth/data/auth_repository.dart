import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/constants.dart';

/// Handles staff authentication against the custom `employees` Supabase table.
///
/// NOTE: We intentionally do NOT use Supabase Auth (email/password sign-in)
/// because staff accounts are managed via the admin dashboard using a plain
/// `employees` table with emp_id + password columns.  Supabase Auth rows are
/// a different concept and unrelated here.
class AuthRepository {
  final _supabase = Supabase.instance.client;

  // ── Current session (held in memory; restored via SecureStorage in di.dart) ─

  Map<String, dynamic>? _currentEmployee;

  Map<String, dynamic>? get currentEmployee => _currentEmployee;

  /// Returns the logged-in employee's ID, or null if not authenticated.
  String? getCurrentUserId() => _currentEmployee?[AppConstants.empIdColumn] as String?;

  /// Returns the logged-in employee's display name.
  String getCurrentUserName() =>
      (_currentEmployee?[AppConstants.empNameColumn] as String?) ?? 'Staff';

  // ── Login ─────────────────────────────────────────────────────────────────

  /// Finds the employee by [username] (emp_id) and verifies [password].
  ///
  /// Returns `true` on success, `false` on bad credentials, and throws on
  /// network / database errors so the calling BLoC can surface them.
  Future<bool> login(String username, String password) async {
    debugPrint('[AuthRepository] login() called for emp_id: $username');

    final String trimmedId = username.trim();
    final String trimmedPw = password.trim();

    if (trimmedId.isEmpty || trimmedPw.isEmpty) {
      debugPrint('[AuthRepository] login() – empty username or password');
      return false;
    }

    try {
      // Query the employees table directly (case-insensitive username).
      final List<dynamic> rows = await _supabase
          .from(AppConstants.employeesTable)
          .select()
          .ilike(AppConstants.empIdColumn, trimmedId)
          .limit(1);

      if (rows.isEmpty) {
        debugPrint('[AuthRepository] login() – emp_id not found: $trimmedId');
        return false;
      }

      final Map<String, dynamic> emp = rows.first as Map<String, dynamic>;

      // Verify password. The DB stores the password as plain-text (per the
      // existing admin dashboard design). If you later add hashing, update
      // this comparison accordingly.
      final String? storedPw = emp['password'] as String?;
      if (storedPw == null || storedPw != trimmedPw) {
        debugPrint('[AuthRepository] login() – password mismatch for: $trimmedId');
        return false;
      }

      // Check active flag (optional – only applies when the column exists).
      final dynamic activeFlag = emp['active'];
      if (activeFlag != null && activeFlag == false) {
        debugPrint('[AuthRepository] login() – account deactivated: $trimmedId');
        throw Exception('Account is deactivated. Contact admin.');
      }

      _currentEmployee = emp;
      debugPrint('[AuthRepository] login() – SUCCESS for: $trimmedId');
      return true;
    } on Exception {
      rethrow; // Let the BLoC handle and display the error
    } catch (e, st) {
      debugPrint('[AuthRepository] login() – unexpected error: $e\n$st');
      throw Exception('Login failed. Please check your connection and try again.');
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    debugPrint('[AuthRepository] logout() called');
    _currentEmployee = null;
    // No Supabase Auth session to sign out of; we manage auth state ourselves.
  }
}
