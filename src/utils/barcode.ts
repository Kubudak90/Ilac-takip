// İlaç kutusundaki karekodu (GS1 DataMatrix) ve düz barkodu (EAN-13) çözer.
//
// Türkiye'deki ilaç kutularında bulunan karekod GS1 DataMatrix biçimindedir
// ve şu "Uygulama Tanımlayıcılarını" (AI) içerir:
//   (01) GTIN        -> 14 hane, sabit
//   (17) SKT         -> 6 hane YYAAGG, sabit (son kullanma)
//   (10) Parti/Lot   -> değişken, GS ile biter
//   (21) Seri No     -> değişken, GS ile biter
//
// Değişken alanlar FNC1 (GS, ASCII 29 = \x1d) ile ayrılır.

export interface ParsedBarcode {
  /** 14 haneye normalize edilmiş GTIN */
  gtin?: string;
  /** Son kullanma tarihi (kutu) */
  expiry?: Date;
  lot?: string;
  serial?: string;
  /** Karekod çözülemediyse ham veri yine de saklanır */
  raw: string;
}

// FNC1 / Group Separator (ASCII 29)
const GS = String.fromCharCode(29);

/** Bir tarih kodunu (YYAAGG) Date'e çevirir. GG=00 ise ayın son günü. */
function parseExpiry(yymmdd: string): Date | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const year = 2000 + parseInt(yymmdd.slice(0, 2), 10);
  const month = parseInt(yymmdd.slice(2, 4), 10); // 1-12
  let day = parseInt(yymmdd.slice(4, 6), 10);
  if (month < 1 || month > 12) return undefined;
  if (day === 0) {
    // Ayın son günü
    return new Date(year, month, 0);
  }
  if (day > 31) return undefined;
  return new Date(year, month - 1, day);
}

/** EAN-13 / GTIN-13'ü 14 haneye (baş sıfır) normalize eder. */
export function normalizeGtin(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 14) return digits;
  if (digits.length === 13) return '0' + digits;
  if (digits.length === 12) return '00' + digits;
  return digits;
}

/**
 * GS1 DataMatrix verisini çözer. Sabit uzunluklu AI'ları (01, 17) ve
 * değişken AI'ları (10, 21) destekler. Düz EAN-13 ise doğrudan GTIN sayılır.
 */
export function parseGs1(data: string): ParsedBarcode {
  const result: ParsedBarcode = { raw: data };

  // Düz EAN-13 / EAN-8: sadece rakam ve karekod yapısı yoksa GTIN kabul et
  const onlyDigits = data.replace(/\D/g, '');
  if (data === onlyDigits && (data.length === 13 || data.length === 12 || data.length === 8)) {
    result.gtin = normalizeGtin(data);
    return result;
  }

  // Baştaki FNC1 işaretlerini temizle
  let s = data.charAt(0) === GS ? data.slice(1) : data;
  let i = 0;

  const readUntilGS = (): string => {
    let out = '';
    while (i < s.length && s[i] !== GS) {
      out += s[i];
      i++;
    }
    if (s[i] === GS) i++; // ayırıcıyı atla
    return out;
  };

  let guard = 0;
  while (i < s.length && guard++ < 20) {
    // AI'yı oku (2 hane)
    const ai = s.slice(i, i + 2);
    if (!/^\d{2}$/.test(ai)) {
      // Tanınmayan yapı; geri kalanı atla
      break;
    }
    i += 2;

    if (ai === '01') {
      result.gtin = normalizeGtin(s.slice(i, i + 14));
      i += 14;
    } else if (ai === '17') {
      result.expiry = parseExpiry(s.slice(i, i + 6));
      i += 6;
    } else if (ai === '11' || ai === '15' || ai === '13') {
      // diğer tarih AI'ları (üretim vb.) — atla
      i += 6;
    } else if (ai === '10') {
      result.lot = readUntilGS();
    } else if (ai === '21') {
      result.serial = readUntilGS();
    } else {
      // Bilinmeyen değişken AI: GS'e kadar atla
      readUntilGS();
    }
  }

  return result;
}
