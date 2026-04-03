import 'package:get_it/get_it.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/inward/bloc/inward_bloc.dart';
import '../features/inward/data/inward_repository.dart';
import '../features/outward/bloc/outward_bloc.dart';
import '../features/outward/data/outward_repository.dart';
import '../features/challan/data/challan_repository.dart';
import '../features/auth/bloc/auth_bloc.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // Repositories
  sl.registerLazySingleton<AuthRepository>(() => AuthRepository());
  sl.registerLazySingleton<InwardRepository>(() => InwardRepository());
  sl.registerLazySingleton<OutwardRepository>(() => OutwardRepository());
  sl.registerLazySingleton<ChallanRepository>(() => ChallanRepository());

  // Blocs
  sl.registerFactory(() => AuthBloc(sl<AuthRepository>()));
  sl.registerFactory(() => InwardBloc(sl<InwardRepository>()));
  sl.registerFactory(() => OutwardBloc(sl<OutwardRepository>()));
}
