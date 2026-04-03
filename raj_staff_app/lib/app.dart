import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/theme.dart';
import 'core/router.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'package:get_it/get_it.dart';

class RajStaffApp extends StatelessWidget {
  const RajStaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (context) => GetIt.instance<AuthBloc>()..add(AuthCheckStatus())),
      ],
      child: MaterialApp.router(
        title: 'Raj Staff App',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        routerConfig: AppRouter.router,
      ),
    );
  }
}
