import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:raj_staff_app/app.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const RajStaffApp());
    expect(find.text('RAJ ELECTRONICS'), findsOneWidget);
  });
}
