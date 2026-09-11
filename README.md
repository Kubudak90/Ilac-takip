# İlaç Takip

65 yaş üstü **polifarmasi** hastalarının (çok sayıda ilaç kullanan kişiler)
ilaçlarının ve **raporlarının ne zaman biteceğini** takip etmek için yapılmış
mobil uygulama. Hedef kullanıcı **hasta yakını / bakıcı**: bir kişi birden çok
hastayı yönetebilir.

> “Hangi ilaç ne zaman bitiyor? Raporu ne zaman doluyor? Ne zaman gidip
> yazdırmam gerekiyor?” sorularını uygulama sizin yerinize takip eder ve
> zamanı gelince telefonunuza **bildirim** gönderir.

## Ne yapar?

- **Çok hastalı takip** — anne, baba, başka bir yakın… hepsi tek uygulamada.
- **İlaç stoğu takibi** — elde kalan adet gerçek sayımdır; “Aldım” işaretlemesi
  stoktan düşer. Bitiş = bugün + floor(stok ÷ günlük doz). Stok hiç
  girilmemişse yalnız hatırlatma yapılır (yanlış “acil” üretmez).
- **Doz uyumu (adherence)** — ilaç saatlerine “Aldım / Atladım”; Özet’te bugün
  listesi, hasta detayında uyum özeti.
- **Rapor takibi** — raporlu ilaçlarda rapor bitiş tarihini izler.
- **Renkli aciliyet** — kırmızı (acil), turuncu (yakında), sarı (takipte),
  yeşil (sorun yok). Tükenen stoklar ayrı “Tükendi” panelinde.
- **Özet ekranı** — yaklaşan bitişler, bugünkü dozlar, tükenenler.
- **İlaç saati hatırlatması** — günlük alım saatleri; telefon o saatte bildirir.
- **“İlaç yazdırdım” hızlı yenileme** — yeni kutu/reçete alınca stok ekleyin.
- **Karekod ile ekleme** — GS1 DataMatrix: barkod + son kullanma; ad barkod
  defterinde öğrenilir.
- **Bildirimler** — eşik gün kala + bitiş günü; tükenince günlük yenile uyarısı;
  bütçe aşımında sessiz düşürme yerine uyarı; bildirime dokununca derin link.
- **Gizlilik** — cihazda at-rest şifreleme, isteğe bağlı uygulama kilidi,
  kilit ekranında PHI gizleme, KVKK aydınlatma onayı, “tüm verileri sil”.
- **Yedek** — dosya/metin dışa-içe aktarım, isteğe bağlı parola; geri yüklemeden
  önce otomatik anlık yedek (“geri al”).
- **Tamamen çevrimdışı** — veriler telefonda kalır, sunucuya gitmez, üyelik yok.

> **e-Reçete hakkında:** e-reçete kodundan ilaç çekmek mümkün değildir; içerik
> SGK/MEDULA ve e-Nabız’da tutulur ve halka açık API yoktur. Bu yüzden kutu
> karekodu + öğrenen barkod defteri kullanılır.

## Nasıl çalıştırılır?

Gerekenler: Node.js 18+ ve telefonda **Expo Go** (App Store / Google Play).

```bash
npm install
npx expo start
```

Çıkan QR kodu Expo Go ile okutun. Bildirim testi: **Ayarlar → Test bildirimi gönder**.

### Kontroller

```bash
npm run typecheck
npm run lint
npm test
```

### Mağazaya çıkarmak (ileride)

EAS projesi ve marka varlıkları henüz bağlanmamış; `eas.json` / `projectId`
eklendikten sonra:

```bash
npm install -g eas-cli
eas build --platform android   # veya ios
```

## Hesaplama mantığı

**İlaç bitiş tarihi** (yalnızca stok takibi açılmış ilaçlarda):
```
kalan gün   = aşağı yuvarla(elde kalan adet ÷ günde kullanılan adet)
bitiş tarihi = bugün + kalan gün
```
Stok “Aldım” / yenileme / düzenleme ile güncellenir; tarih-bazlı tahmini azalma yok.

**Aciliyet seviyesi** (uyarı eşiği = Ayarlar’daki “kaç gün önceden”, varsayılan 7):

| Kalan gün             | Seviye   | Renk    |
|-----------------------|----------|---------|
| 3 gün ve altı / bitti | Acil     | Kırmızı |
| eşik gününe kadar     | Yakında  | Turuncu |
| eşiğin 2 katına kadar | Takipte  | Sarı    |
| daha fazla            | Sorun yok| Yeşil   |

## Proje yapısı

```
app/                      # Ekranlar (expo-router)
  _layout.tsx             # Kök yerleşim + sağlayıcılar / kilit / KVKK
  (tabs)/                 # Özet, Hastalar, Ayarlar
  hasta/[id].tsx          # Hasta detayı + ilaç listesi + uyum
  hasta/duzenle.tsx       # Hasta ekle/düzenle
  ilac/duzenle.tsx        # İlaç ekle/düzenle
  ilac/tara.tsx           # Karekod (GS1 DataMatrix)
  ilac/yenile.tsx         # Hızlı stok yenileme
  uyum.tsx                # Uyum geçmişi
  yedek.tsx               # Yedekle / geri yükle
  gizlilik.tsx            # Gizlilik / KVKK / tüm veriyi sil
src/
  types.ts
  theme.ts
  privacy.ts
  store/                  # DataContext + şifreli AsyncStorage
  utils/                  # tarih, durum, bildirim, adherence, barkod
  components/             # UI, kilit, consent, bildirim yönlendirme
```

## Bu sürümde

- Doz uyumu + gerçek stok sayımı
- At-rest şifreleme, uygulama kilidi, bildirim PHI gizleme, KVKK onayı
- Dosya yedek + opsiyonel parola + geri yükleme “geri al”
- Bildirim derin link + cihaz bütçe uyarısı
- Stok tükenince eskalasyon; salt-hatırlatmada yanlış “acil” yok
- Error Boundary; saf mantık birim testleri

## Bilinçli kapsam dışı (sonraki sürümler)

- Hasta bazlı bildirim susturma / snooze
- Silme geri alma (silmeler onayla korunur; yedek kalıcı kaybı önler)
- EAS / mağaza varlıkları ve production bildirim izin doğrulaması

## Teknolojiler

Expo (React Native) · TypeScript · expo-router · expo-notifications ·
expo-camera · expo-secure-store · expo-local-authentication ·
AsyncStorage · crypto-js · Jest

---

**Not:** Bu uygulama bir takip/hatırlatma aracıdır, tıbbi tavsiye yerine
geçmez. İlaç kullanımıyla ilgili kararlar için doktor/eczacıya danışın.
