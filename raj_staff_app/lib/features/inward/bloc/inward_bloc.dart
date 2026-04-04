import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../data/inward_repository.dart';
import '../../../shared/models/inward_batch.dart';

// ── Events ────────────────────────────────────────────────────────────────────

abstract class InwardEvent extends Equatable {
  const InwardEvent();

  @override
  List<Object?> get props => [];
}

class InwardSaveRequested extends InwardEvent {
  final InwardBatch batch;
  const InwardSaveRequested(this.batch);
  @override
  List<Object?> get props => [batch];
}

class InwardLoadConfig extends InwardEvent {
  const InwardLoadConfig();
}

// ── States ────────────────────────────────────────────────────────────────────

abstract class InwardState extends Equatable {
  const InwardState();

  @override
  List<Object?> get props => [];
}

class InwardInitial extends InwardState {
  const InwardInitial();
}

class InwardLoading extends InwardState {
  const InwardLoading();
}

class InwardConfigLoaded extends InwardState {
  final List<String> godowns;
  const InwardConfigLoaded(this.godowns);
  @override
  List<Object?> get props => [godowns];
}

class InwardSaveSuccess extends InwardState {
  final int count;
  /// Number of serials that were skipped because they already exist.
  final int skipped;
  const InwardSaveSuccess(this.count, {this.skipped = 0});
  @override
  List<Object?> get props => [count, skipped];
}

class InwardError extends InwardState {
  final String message;
  const InwardError(this.message);
  @override
  List<Object?> get props => [message];
}

// ── Bloc ──────────────────────────────────────────────────────────────────────

class InwardBloc extends Bloc<InwardEvent, InwardState> {
  final InwardRepository repository;

  InwardBloc(this.repository) : super(InwardInitial()) {
    // ── Load godowns from config ──────────────────────────────────────────
    on<InwardLoadConfig>((event, emit) async {
      debugPrint('[InwardBloc] InwardLoadConfig');
      emit(InwardLoading());
      try {
        final godowns = await repository.getGodowns();
        debugPrint('[InwardBloc] Config loaded – ${godowns.length} godowns');
        emit(InwardConfigLoaded(godowns));
      } catch (e) {
        debugPrint('[InwardBloc] getGodowns error: $e – using defaults');
        // Non-critical: fall back to defaults instead of showing error
        emit(InwardConfigLoaded(['Main Godown', 'Showroom']));
      }
    });

    // ── Save inward batch ─────────────────────────────────────────────────
    on<InwardSaveRequested>((event, emit) async {
      debugPrint(
        '[InwardBloc] InwardSaveRequested – '
        '${event.batch.serialNos.length} serials, '
        'brand=${event.batch.brand}',
      );
      emit(InwardLoading());

      try {
        final success = await repository.saveInward(event.batch);
        if (success) {
          debugPrint('[InwardBloc] Save SUCCESS');
          emit(InwardSaveSuccess(event.batch.serialNos.length));
        } else {
          emit(InwardError('Save returned false. Please try again.'));
        }
      } on Exception catch (e) {
        final msg = e.toString().replaceFirst('Exception: ', '');
        debugPrint('[InwardBloc] Save EXCEPTION – $msg');
        emit(InwardError(msg));
      } catch (e, st) {
        debugPrint('[InwardBloc] Save UNEXPECTED ERROR – $e\n$st');
        emit(InwardError('An unexpected error occurred. Please try again.'));
      }
    });
  }
}
