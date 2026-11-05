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
- **Esnek doz ve kullanım takvimi** — her gün (`daily`), haftanın belirli günleri
  (`weekdays`, örn. Pzt-Çar-Cum), belirli gün aralıklı (`interval`, örn. gün aşırı
  veya haftada bir) ve ihtiyaç halinde / lüzum halinde (`prn`) ilaç takibi.
- **Aç / Tok / Yemekle etiketleri** — her ilaç için “Aç karnına”, “Tok karnına” veya
  “Yemekle birlikte” bilgisi kartlarda, doz listesinde, bildirimlerde ve doktor özetinde görünür.
- **İlaç stoğu takibi** — elde kalan adet gerçek sayımdır; “Aldım” veya “İhtiyaç Dozu Aldım”
  işaretlemesi stoktan düşer. Bitiş tarihi seçili kullanım takvimine göre (gün aşırı /
  haftalık günler dahil) otomatik hesaplanır. Stok takibi kapatılırsa yalnız hatırlatma
  yapılır (yanlış “acil” üretmez).
- **Doz uyumu (adherence)** — ilaç saatlerine “Aldım / Atladım / Ertele”; Özet’te bugün
  listesi, hasta detayında uyum özeti ve son 7/30 gün istatistikleri.
- **Doktor / Eczane Özeti & Reçete Yenileme Listesi** — tek dokunuşla doktor muayenesi
  için kapsamlı hasta ilaç ve uyum özeti veya eczane/aile hekimi için yalnızca acil
  yazdırılması gereken ilaç/raporları içeren **Reçete / Eczane Yenileme Listesi** paylaşımı.
- **Gelişmiş arama, filtreleme ve sıralama** — Özet ekranında hasta ve kategori (Stok /
  Rapor / SKT) filtreleri; Hastalar ekranında hasta/not/ilaç adına göre anlık arama ve
  durum filtresi; Hasta detayında ilaç arama, filtreleme (Tümü / Acil / Raporlu / İhtiyaç)
  ve sıralama (Aciliyet / A-Z).
- **Görünüm ve erişilebilirlik** — 65+ yaş ve az gören kullanıcılar için **Büyük Yazı
  Modu** ve gece kullanımı için **Karanlık Mod (Dark Mode)**.
- **Rapor ve SKT takibi** — raporlu ilaçlarda rapor bitiş tarihini, kutularda son
  kullanma tarihini izler; SKT’ye 30 gün kala erken uyarı ve SKT geçtiğinde günlük
  uyarı verir.
- **Bildirim erteleme (Snooze)** — hasta bazında 4 saat / 24 saat / 3 gün / 1 hafta
  geçici bildirim erteleme (`snoozeUntil`) ve tekil doz hatırlatmalarını 15 dk / 30 dk /
  1 saat erteleme.
- **“İlaç yazdırdım” hızlı yenileme** — yeni kutu/reçete alınca stok ekleyin.
- **Karekod ile ekleme** — GS1 DataMatrix: barkod + son kullanma; ad barkod
  defterinde öğrenilir.
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

`eas.json` iskeleti hazır. Expo hesabında proje oluşturup `app.json` içine
`extra.eas.projectId` ekledikten sonra:

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

## Hesaplama mantığı

**İlaç bitiş tarihi** (yalnızca stok takibi açılmış ve sabit takvimli ilaçlarda):
```
ortalama günlük doz =
  • Her gün:           dailyDose
  • Belirli günler:    dailyDose × (seçili gün sayısı ÷ 7)
  • Gün aralıklı (N):  dailyDose ÷ N
kalan gün    = aşağı yuvarla(elde kalan adet ÷ ortalama günlük doz)
bitiş tarihi = bugün + kalan gün
```
Stok “Aldım” / PRN kullanım / yenileme / düzenleme ile güncellenir; tarih-bazlı tahmini azalma yok.

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
  _layout.tsx             # Kök yerleşim + sağlayıcılar / kilit / KVKK / tema
  (tabs)/                 # Özet, Hastalar, Ayarlar
  hasta/[id].tsx          # Hasta detayı + ilaç listesi + arama/filtre + uyum + erteleme
  hasta/duzenle.tsx       # Hasta ekle/düzenle
  ilac/duzenle.tsx        # İlaç ekle/düzenle (esnek takvim + aç/tok)
  ilac/tara.tsx           # Karekod (GS1 DataMatrix)
  ilac/yenile.tsx         # Hızlı stok yenileme
  uyum.tsx                # Uyum geçmişi
  yedek.tsx               # Yedekle / geri yükle
  gizlilik.tsx            # Gizlilik / KVKK / tüm veriyi sil
src/
  types.ts
  theme.ts                # Açık/Karanlık tema + Normal/Büyük yazı ölçeği
  privacy.ts
  store/                  # DataContext + şifreli AsyncStorage
  utils/                  # tarih, durum, bildirim, adherence, barkod, doktor/eczane raporu
  components/             # UI, kilit, consent, bildirim yönlendirme
```

## Bu sürümde

- Esnek kullanım takvimleri (her gün, haftanın günleri, gün aşırı/aralıklı, ihtiyaç halinde/PRN)
- Aç karnına / Tok karnına / Yemekle birlikte kullanım etiketleri
- Doktor & Eczane tam hasta özeti + acil Reçete / Eczane Yenileme Listesi paylaşımı
- Özet, Hastalar ve Hasta Detayı ekranlarında gelişmiş arama, filtreleme ve sıralama
- Karanlık Mod (Dark Mode) ve 65+ yaş dostu Büyük Yazı Modu
- Hasta bazlı geçici bildirim erteleme (`snoozeUntil`) ve tekil doz hatırlatma erteleme (15 dk / 30 dk / 1 saat)
- SKT geçen kutular için günlük uyarı + SKT’ye 30 gün kala erken uyarı
- Doz uyumu + gerçek stok sayımı
- At-rest şifreleme, uygulama kilidi, bildirim PHI gizleme, KVKK onayı
- Dosya yedek + opsiyonel parola + geri yükleme “geri al”
- Bildirim derin link + cihaz bütçe uyarısı
- Error Boundary; saf mantık birim testleri

## Bilinçli kapsam dışı (sonraki sürümler)

- EAS `projectId` / mağaza hesap bağlama ve özel marka ikonları
- Production Play/App Store gönderimi
- Web önizleme (`react-native-web` yok; yalnızca Expo Go iOS/Android)

## Teknolojiler

Expo (React Native) · TypeScript · expo-router · expo-notifications ·
expo-camera · expo-secure-store · expo-local-authentication ·
AsyncStorage · crypto-js · Jest

---

**Not:** Bu uygulama bir takip/hatırlatma aracıdır, tıbbi tavsiye yerine
geçmez. İlaç kullanımıyla ilgili kararlar için doktor/eczacıya danışın.
