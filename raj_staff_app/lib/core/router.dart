import 'package:go_router/go_router.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/inward/screens/inward_screen.dart';
import '../features/outward/screens/outward_screen.dart';
import '../features/challan/screens/challan_screen.dart';

class AppRouter {
  static final router = GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/inward',
        builder: (context, state) => const InwardScreen(),
      ),
      GoRoute(
        path: '/outward',
        builder: (context, state) => const OutwardScreen(),
      ),
      GoRoute(
        path: '/challan/:id',
        builder: (context, state) => ChallanScreen(id: state.pathParameters['id']!),
      ),
    ],
  );
}
