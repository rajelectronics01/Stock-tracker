import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../data/outward_repository.dart';
import '../../../shared/models/outward_batch.dart';

// ── Events ────────────────────────────────────────────────────────────────────

abstract class OutwardEvent extends Equatable {
  const OutwardEvent();

  @override
  List<Object?> get props => [];
}

class OutwardVerifySerial extends OutwardEvent {
  final String serial;
  const OutwardVerifySerial(this.serial);
  @override
  List<Object?> get props => [serial];
}

class OutwardSaveRequested extends OutwardEvent {
  final OutwardBatch batch;
  const OutwardSaveRequested(this.batch);
  @override
  List<Object?> get props => [batch];
}

// ── States ────────────────────────────────────────────────────────────────────

abstract class OutwardState extends Equatable {
  const OutwardState();

  @override
  List<Object?> get props => [];
}

class OutwardInitial extends OutwardState {}

class OutwardVerifying extends OutwardState {}

class OutwardVerifyResult extends OutwardState {
  final String serial;
  final bool isValid;
  final String? errorMessage;
  final Map<String, dynamic>? itemData;

  const OutwardVerifyResult(
    this.serial,
    this.isValid, {
    this.errorMessage,
    this.itemData,
  });

  @override
  List<Object?> get props => [serial, isValid, errorMessage, itemData];
}

class OutwardLoading extends OutwardState {}

class OutwardSaveSuccess extends OutwardState {
  final String challanNo;
  const OutwardSaveSuccess(this.challanNo);
  @override
  List<Object?> get props => [challanNo];
}

class OutwardError extends OutwardState {
  final String message;
  const OutwardError(this.message);
  @override
  List<Object?> get props => [message];
}

// ── Bloc ──────────────────────────────────────────────────────────────────────

class OutwardBloc extends Bloc<OutwardEvent, OutwardState> {
  final OutwardRepository repository;

  OutwardBloc(this.repository) : super(OutwardInitial()) {
    // ── Verify a scanned serial ───────────────────────────────────────────
    on<OutwardVerifySerial>((event, emit) async {
      debugPrint('[OutwardBloc] OutwardVerifySerial – ${event.serial}');
      emit(OutwardVerifying());

      try {
        final res = await repository.verifySerial(event.serial);
        if (res != null && res['status'] == 'IN STOCK') {
          debugPrint('[OutwardBloc] Verify OK – ${event.serial} is IN STOCK');
          emit(OutwardVerifyResult(
            event.serial,
            true,
            itemData: res['data'] as Map<String, dynamic>?,
          ));
        } else {
          final status = (res?['status'] as String?) ?? 'Not found in inventory';
          debugPrint('[OutwardBloc] Verify FAIL – ${event.serial}: $status');
          emit(OutwardVerifyResult(event.serial, false, errorMessage: status));
        }
      } catch (e) {
        debugPrint('[OutwardBloc] verifySerial error: $e');
        emit(OutwardVerifyResult(event.serial, false, errorMessage: 'Verification error'));
      }
    });

    // ── Save dispatch batch ───────────────────────────────────────────────
    on<OutwardSaveRequested>((event, emit) async {
      debugPrint('[OutwardBloc] OutwardSaveRequested – challan=${event.batch.challanNo}');
      emit(OutwardLoading());

      try {
        final success = await repository.saveOutward(event.batch);
        if (success) {
          debugPrint('[OutwardBloc] Save SUCCESS – challan=${event.batch.challanNo}');
          emit(OutwardSaveSuccess(event.batch.challanNo));
        } else {
          emit(const OutwardError('Failed to save dispatch. Please try again.'));
        }
      } on Exception catch (e) {
        final msg = e.toString().replaceFirst('Exception: ', '');
        debugPrint('[OutwardBloc] Save EXCEPTION – $msg');
        emit(OutwardError(msg));
      } catch (e, st) {
        debugPrint('[OutwardBloc] Save UNEXPECTED ERROR – $e\n$st');
        emit(const OutwardError('An unexpected error occurred. Please try again.'));
      }
    });
  }
}
