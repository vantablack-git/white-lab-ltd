# Claude Prompt Şablonları

Aşağıdaki metinleri olduğu gibi kopyala-yapıştır. `[...]` alanlarını doldur.

---

## Ana brief (ilk mesaj — önerilen)

```
Sen WhiteLab ($WLAB) protokolünün lead Solidity mühendisisin.

BAĞLAM:
- claude-handoff/ klasöründeki 01–06 numaralı dosyaları oku.
- Ürün: WhiteLab Launch OS — Base L2 üzerinde compliance-friendly token launchpad.
- DEC-001..009 mimari kararları DEĞİŞTİRME.

MEVCUT DURUM:
- 17/17 test geçiyor ama P0 teknik borç var (04-KNOWN-ISSUES-AND-TODO.md).
- TokenSale token dağıtımı ve fee+votes sorunu çözülmeli.

GÖREV (bu oturum):
1. WLABTokenSale.sol — tam IDO akışı: buy, finalize, claim, vesting entegrasyonu
2. WLABToken.sol — transfer fee + ERC20Votes uyumlu tek çözüm
3. Testleri genişlet; npm test yeşil kalsın
4. ARCHITECT_LOG.md'ye yapılanları yaz

ÇIKTI FORMATI:
- Her değişiklik için: dosya adı, ne değişti, neden
- Sonunda: çalıştırılacak komutlar listesi
- Placeholder veya "TODO" bırakma
```

---

## Sadece güvenlik review

```
WhiteLab contracts/ klasörünü audit et.
Bağlam: claude-handoff/03 ve 04.

Çıktı tablosu:
| Severity | Dosya | Satır | Sorun | Fix önerisi |

Critical/High için düzeltme patch'i (Solidity diff) ver.
DEC kararlarına aykırı öneri yapma.
```

---

## Sepolia deploy oturumu

```
WhiteLab repo deploy hazırlığı.

Okuduğun: docs/06-deployment.md, scripts/deploy.js, hardhat.config.js

Görev:
1. .env.example açıklamalarını genişlet
2. deploy.js — multisig parametreleri, allocation mint dağıtımı
3. Post-deploy verify komutları (Base Sepolia)
4. deployments/base-sepolia.json şema örneği

Private key isteme. Sadece komut ve checklist ver.
```

---

## "Completed proje" final oturumu

```
WhiteLab'i "completed" seviyesine getir.

Checklist: claude-handoff/06-COMPLETION-CHECKLIST.md

Eksik maddeleri kapat. Her madde için:
- [x] veya [ ] 
- kanıt (test çıktısı / dosya yolu)

DEC kararlarına sadık kal. Yeni scope ekleme (frontend hariç tutulabilir).
```

---

## İstişare sorusu (strateji)

```
WhiteLab tokenomics ve launch stratejisi için 3 seçenek sun:

Seçenek A / B / C formatında:
- TGE dolaşım etkisi
- Satış baskısı riski
- Regülasyon riski (MiCA utility framing)
- Uygulama karmaşıklığı (1-5)

Mevcut dağıtım tablosu: docs/03-tokenomics.md
Karar verme — sadece analiz ve öneri.
```

---

## Claude ile çalışırken kaçınılacaklar

- ❌ "Yeni token adı / farklı chain" önerme (DEC locked)
- ❌ Tüm repo'yu sıfırdan yazma
- ❌ Placeholder `// TODO` bırakma
- ✅ Küçük PR mantığında, test ile birlikte değişiklik
- ✅ Her oturum sonu `ARCHITECT_LOG.md` güncellemesi
