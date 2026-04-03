import 'package:flutter/material.dart';
import '../../../core/theme.dart';

class SerialChip extends StatelessWidget {
  final String serial;
  final VoidCallback onDelete;

  const SerialChip({
    super.key,
    required this.serial,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.surface.withAlpha(200),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.qr_code_2, color: Colors.white.withAlpha(150), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              serial,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w800,
                fontFamily: 'JetBrains Mono',
              ),
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            onTap: onDelete,
            child: const Icon(Icons.close, color: Colors.white, size: 18),
          ),
        ],
      ),
    );
  }
}
