import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../shared/models/inward_batch.dart';

/// Handles saving inward batches and fetching config from Supabase.
///
/// Table layout expected in Supabase:
///   inward_batches  – one row per batch submission
///   inventory       – one row per serial number (status = 'IN STOCK')
///   config          – single row with a `godowns` text[] column
class InwardRepository {
  final _supabase = Supabase.instance.client;

  // ── Save ──────────────────────────────────────────────────────────────────

  /// Persists [batch] to Supabase.
  ///
  /// Returns `true` on success.
  /// Throws on network / database errors so the BLoC can surface them cleanly.
  Future<bool> saveInward(InwardBatch batch) async {
    debugPrint(
      '[InwardRepository] saveInward() – godown=${batch.godown}, '
      'brand=${batch.brand}, model=${batch.model}, '
      'serials=${batch.serialNos.length}',
    );

    try {
      // 1. Insert the batch record --------------------------------------------
      final batchRes = await _supabase
          .from('inward_batches')
          .insert({
            'date': batch.date,
            'godown': batch.godown,
            'brand': batch.brand,
            'model': batch.model,
            'staff_id': batch.staffId,
            'serial_nos': batch.serialNos,
            'created_at': DateTime.now().toIso8601String(),
          })
          .select('id')
          .single();

      debugPrint('[InwardRepository] saveInward() – batch inserted, id=${batchRes['id']}');

      // 2. Upsert one inventory row per serial number ------------------------
      final List<Map<String, dynamic>> inventoryRows = batch.serialNos
          .map((serial) => {
                'serial_no': serial,
                'brand': batch.brand,
                'model': batch.model,
                'godown': batch.godown,
                'status': 'IN STOCK',
                'inward_date': DateTime.now().toIso8601String(),
                'staff_id': batch.staffId,
              })
          .toList();

      await _supabase
          .from('inventory')
          .upsert(inventoryRows, onConflict: 'serial_no');

      debugPrint(
        '[InwardRepository] saveInward() – ${batch.serialNos.length} '
        'inventory rows upserted',
      );

      return true;
    } on PostgrestException catch (e) {
      debugPrint('[InwardRepository] saveInward() – PostgrestException: ${e.message}');
      throw Exception('Database error: ${e.message}');
    } catch (e, st) {
      debugPrint('[InwardRepository] saveInward() – unexpected error: $e\n$st');
      throw Exception('Failed to save inward batch. Check your connection.');
    }
  }

  // ── Config ────────────────────────────────────────────────────────────────

  /// Fetches the list of godowns from the `config` table.
  /// Falls back to defaults if the table is empty or unavailable.
  Future<List<String>> getGodowns() async {
    debugPrint('[InwardRepository] getGodowns()');
    try {
      final response = await _supabase
          .from('config')
          .select('godowns')
          .maybeSingle(); // won't throw if no row exists

      if (response == null || response['godowns'] == null) {
        debugPrint('[InwardRepository] getGodowns() – no config row, using defaults');
        return _defaultGodowns;
      }

      final List<String> godowns = List<String>.from(response['godowns'] as List);
      debugPrint('[InwardRepository] getGodowns() – loaded ${godowns.length} godowns');
      return godowns;
    } on PostgrestException catch (e) {
      debugPrint('[InwardRepository] getGodowns() – PostgrestException: ${e.message}, using defaults');
      return _defaultGodowns;
    } catch (e) {
      debugPrint('[InwardRepository] getGodowns() – error: $e, using defaults');
      return _defaultGodowns;
    }
  }

  static const List<String> _defaultGodowns = ['Main Godown', 'Showroom'];
}
