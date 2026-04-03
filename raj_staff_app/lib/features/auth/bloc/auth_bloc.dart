import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../data/auth_repository.dart';

// ── Events ────────────────────────────────────────────────────────────────────

abstract class AuthEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

/// Fired on app startup to restore any persisted session.
class AuthCheckStatus extends AuthEvent {}

/// Fired when the user taps "Login".
class AuthLoginRequested extends AuthEvent {
  final String username;
  final String password;
  const AuthLoginRequested(this.username, this.password);
  @override
  List<Object?> get props => [username, password];
}

/// Fired when the user taps "Logout".
class AuthLogoutRequested extends AuthEvent {}

// ── States ────────────────────────────────────────────────────────────────────

abstract class AuthState extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class AuthAuthenticated extends AuthState {
  final String userId;
  final String displayName;
  const AuthAuthenticated(this.userId, {this.displayName = 'Staff'});
  @override
  List<Object?> get props => [userId, displayName];
}

class AuthUnauthenticated extends AuthState {}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);
  @override
  List<Object?> get props => [message];
}

// ── Bloc ──────────────────────────────────────────────────────────────────────

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository repository;

  AuthBloc(this.repository) : super(AuthInitial()) {
    // ── Check if a session is already active ──────────────────────────────
    on<AuthCheckStatus>((event, emit) async {
      debugPrint('[AuthBloc] AuthCheckStatus – checking in-memory employee');
      final userId = repository.getCurrentUserId();
      if (userId != null) {
        debugPrint('[AuthBloc] AuthCheckStatus – session found: $userId');
        emit(AuthAuthenticated(
          userId,
          displayName: repository.getCurrentUserName(),
        ));
      } else {
        debugPrint('[AuthBloc] AuthCheckStatus – no active session');
        emit(AuthUnauthenticated());
      }
    });

    // ── Handle login attempt ──────────────────────────────────────────────
    on<AuthLoginRequested>((event, emit) async {
      debugPrint('[AuthBloc] AuthLoginRequested – username: ${event.username}');
      emit(AuthLoading());
      try {
        final success = await repository.login(event.username, event.password);
        if (success) {
          final userId = repository.getCurrentUserId() ?? event.username.toUpperCase();
          final name = repository.getCurrentUserName();
          debugPrint('[AuthBloc] Login SUCCESS – userId: $userId, name: $name');
          emit(AuthAuthenticated(userId, displayName: name));
        } else {
          debugPrint('[AuthBloc] Login FAILED – invalid credentials');
          emit(const AuthError('Invalid Employee ID or Password.'));
        }
      } on Exception catch (e) {
        // Exceptions from AuthRepository carry user-friendly messages.
        final msg = e.toString().replaceFirst('Exception: ', '');
        debugPrint('[AuthBloc] Login EXCEPTION – $msg');
        emit(AuthError(msg));
      } catch (e, st) {
        debugPrint('[AuthBloc] Login UNEXPECTED ERROR – $e\n$st');
        emit(const AuthError('An unexpected error occurred. Please try again.'));
      }
    });

    // ── Handle logout ─────────────────────────────────────────────────────
    on<AuthLogoutRequested>((event, emit) async {
      debugPrint('[AuthBloc] AuthLogoutRequested');
      await repository.logout();
      emit(AuthUnauthenticated());
    });
  }
}
