# WhiteLab — Claude Handoff Paketi

Bu klasör, projeyi **Claude ile istişare ederek** tamamlanmış (production-ready) hale getirmek için hazırlanmıştır.

---

## Nasıl kullanılır?

1. **Tüm `claude-handoff/` klasörünü** Claude'a yükle (veya içindeki `.md` dosyalarını tek seferde yapıştır).
2. İlk mesajda şunu yaz:

```
WhiteLab kripto projesi üzerinde çalışıyorum. claude-handoff/ klasöründeki
tüm dosyaları bağlam olarak oku. Özellikle 05-CLAUDE-PROMPT-TEMPLATE.md
içindeki "Ana brief"i uygula. Mevcut repo'yu fork etmeden geliştir;
DEC-001..009 kararlarına sadık kal.
```

3. Claude'dan kod yazmasını istiyorsan **tüm `whitelab/` repo'sunu** da ekle (özellikle `contracts/` ve `test/`).

---

## Dosya sırası (okuma önceliği)

| Sıra | Dosya | Amaç |
|------|--------|------|
| 1 | `01-PROJECT-STATUS.md` | Ne bitti, ne eksik |
| 2 | `02-FILE-STRUCTURE.md` | Dizin haritası |
| 3 | `03-ARCHITECTURE-DECISIONS.md` | Değiştirilemez kararlar |
| 4 | `04-KNOWN-ISSUES-AND-TODO.md` | Öncelikli iş listesi |
| 5 | `05-CLAUDE-PROMPT-TEMPLATE.md` | Hazır promptlar |
| 6 | `06-COMPLETION-CHECKLIST.md` | "Completed" tanımı |

---

## Önerilen iş akışı (Claude ile)

```
Faz A → Teknik borç (TokenSale, fee+votes)     [1-2 oturum]
Faz B → Coverage %95+, fuzz testler            [1 oturum]
Faz C → Sepolia deploy + verify                [1 oturum]
Faz D → Frontend/SDK (opsiyonel)               [ayrı repo]
Faz E → Audit hazırlık + dokümantasyon sync    [1 oturum]
```

Her oturum sonunda `ARCHITECT_LOG.md` güncellenmeli.

---

## Repo kökü

```
c:\Users\zylmz\OneDrive\Desktop\some shit\projects\whitelab\
```

**Test durumu (son doğrulama):** `17 passing / 17` — `npm test`

---

*Bu paket Cursor (Baş Mimar) tarafından üretilmiştir. Plan dosyasına dokunma.*
