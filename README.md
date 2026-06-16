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
- 🔔 **Bildirimler** — bitişe ayarladığınız gün kala (örn. 7 gün) hatırlatma.
- 📵 **Tamamen çevrimdışı** — veriler yalnızca telefonda saklanır (AsyncStorage),
  sunucuya gitmez, üyelik gerektirmez.

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
  ilac/duzenle.tsx        # İlaç ekle/düzenle (canlı bitiş önizlemesi)
src/
  types.ts                # Veri modelleri
  theme.ts                # Renkler, ölçüler
  store/                  # DataContext + AsyncStorage kalıcılık
  utils/                  # Tarih, durum/aciliyet ve bildirim mantığı
  components/             # Ortak UI bileşenleri
```

## Teknolojiler

Expo (React Native) · TypeScript · expo-router · expo-notifications ·
AsyncStorage · @react-native-community/datetimepicker

---

⚠️ **Not:** Bu uygulama bir takip/hatırlatma aracıdır, tıbbi tavsiye yerine
geçmez. İlaç kullanımıyla ilgili kararlar için doktor/eczacıya danışın.
