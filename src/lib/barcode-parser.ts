// ──────────────────────────────────────────────────────
//  Barcode Field Parser — configurable per brand format
//  Maps a raw barcode string → structured product fields
// ──────────────────────────────────────────────────────

export interface ParsedProduct {
  brand?: string;
  model?: string;
  category?: string;
  hsnCode?: string;
  serialNo?: string;
  raw: string;
}

// ── Configurable Brand Format Map ─────────────────────
// Each entry defines how to split and map a barcode string
// for a specific brand. Add/edit entries here without
// touching any other code.

interface BrandFormat {
  // Regex to detect this format from the raw string
  detect: RegExp;
  // How to split the string into parts
  delimiter?: string | RegExp;
  // Map from part index → field name
  fieldMap?: Record<number, keyof Omit<ParsedProduct, 'raw'>>;
  // Custom parser function (optional override)
  parse?: (raw: string) => Omit<ParsedProduct, 'raw'>;
}

const BRAND_FORMATS: BrandFormat[] = [
  // ── Pipe-delimited: SAMSUNG|WA70T4262GG|WASHING_MACHINE|8450
  {
    detect: /^[A-Z]+\|[^\|]+\|[^\|]+/,
    delimiter: '|',
    fieldMap: { 0: 'brand', 1: 'model', 2: 'category', 3: 'hsnCode' },
  },

  // ── Tilde-delimited: LG~GN-B402SQCL~Refrigerator~8418
  {
    detect: /^[A-Z]+~[^~]+~[^~]+/,
    delimiter: '~',
    fieldMap: { 0: 'brand', 1: 'model', 2: 'category', 3: 'hsnCode' },
  },

  // ── Comma-delimited: WHIRLPOOL,360,WASHING MACHINE,8450
  {
    detect: /^[A-Z]+,[^,]+,[^,]+/,
    delimiter: ',',
    fieldMap: { 0: 'brand', 1: 'model', 2: 'category', 3: 'hsnCode' },
  },

  // ── Samsung GS format: (S)BRAND(M)MODEL(C)CAT
  {
    detect: /\(S\).+\(M\).+/,
    parse: (raw) => {
      const brand = raw.match(/\(S\)([^(]+)/)?.[1]?.trim();
      const model = raw.match(/\(M\)([^(]+)/)?.[1]?.trim();
      const category = raw.match(/\(C\)([^(]+)/)?.[1]?.trim();
      const hsn = raw.match(/\(H\)([^(]+)/)?.[1]?.trim();
      return { brand, model, category, hsnCode: hsn };
    },
  },

  // ── Voltas format: BRAND/MODEL/CAT/HSN
  {
    detect: /^[A-Z]+\/[^\/]+\/[^\/]+/,
    delimiter: '/',
    fieldMap: { 0: 'brand', 1: 'model', 2: 'category', 3: 'hsnCode' },
  },

  // ── JSON-encoded barcode
  {
    detect: /^\{.+\}$/,
    parse: (raw) => {
      try {
        const obj = JSON.parse(raw);
        return {
          brand: obj.brand || obj.Brand,
          model: obj.model || obj.Model || obj.modelNo,
          category: obj.category || obj.Category,
          hsnCode: obj.hsn || obj.hsnCode || obj.HSN,
          serialNo: obj.serial || obj.serialNo || obj.SrNo,
        };
      } catch { return {}; }
    },
  },
];

// ── Normalize category strings ────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  WASHING_MACHINE: 'Washing Machine',
  WASHER: 'Washing Machine',
  REFRIGERATOR: 'Refrigerator',
  FRIDGE: 'Refrigerator',
  AIR_CONDITIONER: 'Air Conditioner',
  AC: 'Air Conditioner',
  TELEVISION: 'TV',
  TV: 'TV',
  MICROWAVE: 'Microwave',
  WATER_PURIFIER: 'Water Purifier',
  PURIFIER: 'Water Purifier',
};

function normalizeCategory(raw?: string): string | undefined {
  if (!raw) return undefined;
  const key = raw.toUpperCase().replace(/\s+/g, '_');
  return CATEGORY_MAP[key] || raw;
}

// ── Main Parser ───────────────────────────────────────
export function parseBarcode(raw: string): ParsedProduct {
  const trimmed = raw.trim();

  for (const fmt of BRAND_FORMATS) {
    if (!fmt.detect.test(trimmed)) continue;

    let fields: Omit<ParsedProduct, 'raw'> = {};

    if (fmt.parse) {
      fields = fmt.parse(trimmed);
    } else if (fmt.delimiter && fmt.fieldMap) {
      const parts = typeof fmt.delimiter === 'string'
        ? trimmed.split(fmt.delimiter)
        : trimmed.split(fmt.delimiter);
      for (const [idxStr, fieldName] of Object.entries(fmt.fieldMap)) {
        const idx = Number(idxStr);
        if (parts[idx]) {
          (fields as Record<string, string>)[fieldName] = parts[idx].trim();
        }
      }
    }

    // Normalize category casing
    if (fields.category) {
      fields.category = normalizeCategory(fields.category);
    }

    // If brand/model found → treat as product scan, not serial
    if (fields.brand || fields.model) {
      return { ...fields, raw: trimmed };
    }
  }

  // ── Post-Parsing Cleaning logic for serials ──────────
  let clean = trimmed;

  // Bug 1: Handle URLs (PTA verification links)
  if (clean.toLowerCase().startsWith('http://') || clean.toLowerCase().startsWith('https://')) {
    // Extract last path segment from URL
    try {
      const parts = clean.split('/');
      const last = parts.filter(p => !!p).pop();
      if (last) clean = last;
    } catch { /* fallback to original if split fails */ }
  }

  // Bug 2: Strip brand prefixes and non-alphanumeric noise
  // 1. Strip common brand keyword prefixes (HAVELLS, SAMSUNG, etc)
  const brands = [
    'HAVELLS', 'SAMSUNG', 'LG', 'WHIRLPOOL', 'VOLTAS', 'HAIER', 
    'DAIKIN', 'GODREJ', 'IFB', 'WIRLPOOL', 'S. No.', 'LLOYD', 
    'SANSUI', 'JSW', 'TG SMART', 'TG'
  ];
  for (const b of brands) {
    const regex = new RegExp(`^${b}[:\\s-]*`, 'i');
    if (regex.test(clean)) {
      clean = clean.replace(regex, '').trim();
      break;
    }
  }

  // 2. Clear noise - only keep alphanumeric, hyphens, and slashes
  clean = clean.replace(/[^a-zA-Z0-9\-\/]/g, '').trim().toUpperCase();

  // Fallback: plain serial number string
  return { serialNo: clean, raw: trimmed };
}

// ── Distinguish product vs serial scan ───────────────
export function isProductBarcode(parsed: ParsedProduct): boolean {
  return !!(parsed.brand || parsed.model || parsed.category);
}
