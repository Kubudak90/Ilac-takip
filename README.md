# 💊 İlaç Takip

65 yaş üstü **polifarmasi** hastalarının (çok sayıda ilaç kullanan kişiler)
ilaçlarının ve **raporlarının ne zaman biteceğini** takip etmek için yapılmış
mobil uygulama. Hedef kullanıcı **hasta yakını / bakıcı**: bir kişi birden çok
hastayı yönetebilir.

> “Hangi ilaç ne zaman bitiyor? Raporu ne zaman doluyor? Ne zaman gidip
> yazdırmam gerekiyor?” sorularını uygulama sizin yerinize takip eder ve
> zamanı gelince telefonunuza **bildirim** gönderir.

## Ne yapar?

- 👥 **Çok hastalı takip** — anne, baba, başka bir yakın… hepsi tek uygulamada.
- 💊 **İlaç stoğu takibi** — “elde kaç adet var” ve “günde kaç adet” bilgisinden
  ilacın **hangi gün biteceğini otomatik hesaplar**.
- 📄 **Rapor takibi** — raporlu ilaçlarda rapor bitiş tarihini izler.
- 🚦 **Renkli aciliyet** — kırmızı (acil), turuncu (yakında), sarı (takipte),
  yeşil (sorun yok).
- 🏠 **Özet ekranı** — tüm hastalardaki yaklaşan bitişleri en acilden başlayarak
  tek listede gösterir.
- ⏰ **İlaç saati hatırlatması** — her ilaca günlük alım saatleri ekleyin
  (örn. 08:00 ve 20:00), telefon o saatte “ilaç vakti” bildirimi göndersin.
- ✓ **“İlaç yazdırdım” hızlı yenileme** — yeni kutu/reçete alınca tek dokunuşla
  stok ekleyin; bitiş tarihi otomatik güncellensin.
- 📷 **Karekod ile ekleme** — ilaç kutusundaki karekodu (GS1 DataMatrix)
  kameradan okutun: **barkod ve son kullanma tarihi otomatik** dolar. İlaç adını
  bir kez yazınca uygulama o barkodu öğrenir; aynı kutu tekrar okutulduğunda ad
  kendiliğinden gelir. Elle ekleme her zaman açık.
- 🔔 **Bildirimler** — bitişe ayarladığınız gün kala (örn. 7 gün) hatırlatma.
- 📵 **Tamamen çevrimdışı** — veriler yalnızca telefonda saklanır (AsyncStorage),
  sunucuya gitmez, üyelik gerektirmez.

> ℹ️ **e-Reçete hakkında:** Bir e-reçete kodundan ilaçların otomatik çekilmesi
> mümkün değildir; reçete içeriği SGK/MEDULA ve e-Nabız sistemlerinde tutulur ve
> bunlara erişim yalnızca yetkili sağlık kuruluşlarına/eczanelere açıktır (halka
> açık API yoktur). Bu yüzden kutu karekodu okuyup barkod + son kullanma tarihini
> alıyor, ilaç adını “öğrenen barkod defteri” ile yönetiyoruz.

## Nasıl çalıştırılır?

Gerekenler: Node.js 18+ ve telefonunuzda **Expo Go** uygulaması
(App Store / Google Play'den ücretsiz).

```bash
# 1) Bağımlılıkları kurun
npm install

# 2) Geliştirme sunucusunu başlatın
npx expo start
```

Ardından çıkan **QR kodu** telefonla okutun (Expo Go ile). Uygulama telefonunuzda
açılır. Bildirimleri test etmek için **Ayarlar → Test bildirimi gönder**.

> Web önizleme için `npx expo start --web` da çalışır, ancak tarih seçici ve
> bildirimler en doğru şekilde gerçek telefonda (Expo Go) çalışır.

### Mağazaya çıkarmak (ileride)

```bash
npm install -g eas-cli
eas build --platform android   # veya ios
```

## Hesaplama mantığı

**İlaç bitiş tarihi:**
```
kalan gün   = aşağı yuvarla(elde kalan adet ÷ günde kullanılan adet)
bitiş tarihi = stok girildiği tarih + kalan gün
```
İlacı yeniden yazdırıp stoğu güncellediğinizde referans tarih otomatik bugüne
çekilir.

**Aciliyet seviyesi** (uyarı eşiği = Ayarlar'daki “kaç gün önceden”, varsayılan 7):

| Kalan gün            | Seviye   | Renk    |
|----------------------|----------|---------|
| 3 gün ve altı / bitti| Acil     | Kırmızı |
| eşik gününe kadar    | Yakında  | Turuncu |
| eşiğin 2 katına kadar | Takipte | Sarı    |
| daha fazla           | Sorun yok| Yeşil   |

## Proje yapısı

```
app/                      # Ekranlar (expo-router)
  _layout.tsx             # Kök yerleşim + sağlayıcılar
  (tabs)/                 # Alt sekmeler: Özet, Hastalar, Ayarlar
  hasta/[id].tsx          # Hasta detayı + ilaç listesi
  hasta/duzenle.tsx       # Hasta ekle/düzenle
  ilac/duzenle.tsx        # İlaç ekle/düzenle (saatler, son kullanma, canlı önizleme)
  ilac/tara.tsx           # Kamera ile karekod okuma (GS1 DataMatrix)
  ilac/yenile.tsx         # "İlaç yazdırdım" hızlı stok yenileme
  yedek.tsx               # Yedekle / geri yükle (JSON dışa-içe aktarım)
src/
  types.ts                # Veri modelleri
  theme.ts                # Renkler, ölçüler
  store/                  # DataContext + AsyncStorage kalıcılık
  utils/                  # Tarih, durum/aciliyet ve bildirim mantığı
  components/             # Ortak UI bileşenleri
```

## Bu sürümde iyileştirilenler

- 💾 **Yedekleme / geri yükleme** — tüm veriyi tek metne aktarıp paylaşın
  (e-posta, notlar, bulut) ve yeni telefonda geri yükleyin. *(Ayarlar → Yedekle)*
- 🛟 **Veri güvenliği** — depo okunamaz/bozuk olursa veriler artık **silinmez**;
  bozuk kayıt ayrı bir anahtara yedeklenir ve üzerine yazılmaz. Yüklenen veriler
  ayrıca temizlenir (geçersiz/negatif değerler düzeltilir).
- 📤 **İlaç listesini paylaş** — hasta detayında tek dokunuşla doktor/eczane
  için okunaklı liste oluşturup paylaşın.
- 📦 **Son kullanma artık panoda** — kutu son kullanma tarihi yaklaşınca (≤60
  gün) ya da geçince özet ekranında ve bildirimlerde görünür.
- ½ **Yarım doz** — günde 0,5 adet (yarım tablet) gibi ondalık dozlar girilebilir.
- 🔔 **Daha akıllı bildirimler** — günlük "ilaç saati" hatırlatmaları saat
  bazında **birleştirilir** (iOS'un 64 bildirim sınırını aşmamak için), bitişe
  yaklaşınca **iki kademeli** uyarı (eşik + bitiş günü) verilir, tükenen ilacın
  hatırlatması durur, uygulama her açıldığında **güncel tarihe göre** yeniden
  planlanır.
- 🧭 **Önceliklendirme** — hastalar ve ilaçlar en acilden başlayarak sıralanır.
- ⏱️ **iOS tarih/saat seçici** — "Bitti" düğmesiyle düzgün kapanır.
- ♿ **Erişilebilirlik** — daha büyük dokunma alanları, daha okunaklı durum
  renkleri (açık zeminlerde kontrast düzeltildi).

## Bilinçli kapsam dışı (sonraki sürümler)

Bilerek eklenmeyen, ileride değerlendirilebilecek özellikler:

- **Doz alındı / uyum (adherence) günlüğü** — stok şu an tarih-matematiğiyle
  tahmin edilir; "aldım/atladım" kaydı uygulamanın modelini büyük ölçüde
  değiştirir. Stok düzeltmesi "İlaç yazdırdım" ve düzenleme ile yapılır.
- **Hasta bazlı bildirim susturma / erteleme (snooze)** — şimdilik tek genel
  açık/kapalı anahtarı var.
- **Silme geri alma (undo)** — silmeler onay penceresiyle korunur; yedekleme
  kalıcı kaybı önler.

## Teknolojiler

Expo (React Native) · TypeScript · expo-router · expo-notifications ·
expo-camera (karekod) · AsyncStorage · @react-native-community/datetimepicker

---

⚠️ **Not:** Bu uygulama bir takip/hatırlatma aracıdır, tıbbi tavsiye yerine
geçmez. İlaç kullanımıyla ilgili kararlar için doktor/eczacıya danışın.
