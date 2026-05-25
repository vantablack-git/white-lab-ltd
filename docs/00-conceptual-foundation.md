# BÖLÜM 0 — KAVRAMSAL TEMEL (Sıfır Nokta)

WhiteLab Launch OS bağlamında blockchain ve kripto ekonomi kavramları.

---

## 0.1 Blockchain Nedir, Nasıl Çalışır?

**Blockchain**, işlemlerin kronolojik olarak bağlandığı, dağıtık bir defterdir. Merkezi bir banka yerine binlerce **node** (düğüm) aynı defterin kopyasını tutar ve yeni kayıtların geçerliliği üzerinde **consensus** (fikir birliği) sağlar.

| Kavram | Açıklama | WhiteLab örneği |
|--------|----------|-----------------|
| **Block** | Belirli sürede toplanan işlemler paketi | WLAB transferi, IDO katılımı, stake işlemi |
| **Hash** | Bloğun parmak izi; tek bit değişince hash tamamen değişir | Sözleşme bytecode hash'i Etherscan'de doğrulanır |
| **Chain** | Her blok öncekinin hash'ine referans verir | Base üzerinde WhiteLab kontrat adresleri zincirde kalıcıdır |
| **Node** | Ağı doğrulayan/tutan bilgisayar | Base RPC ile Hardhat deploy bağlanır |
| **Consensus** | Hangi bloğun geçerli olduğuna karar mekanizması | Base, Ethereum L1'e dayalı optimistic rollup consensus kullanır |

**WhiteLab çerçevesi:** Launch OS tüm kritik işlemleri (mint, sale, vesting release) on-chain kaydeder; şeffaflık hash zinciri üzerinden herkesçe doğrulanabilir.

**Bölüm özeti:** Blockchain = paylaşılan, değiştirilemez defter. **Sonraki adım:** Token vs coin ayrımı.

---

## 0.2 Token vs Coin

| | **Coin** | **Token** |
|---|----------|-----------|
| Tanım | Kendi blockchain'inin native varlığı | Başka bir zincirde akıllı sözleşme ile oluşturulan varlık |
| Örnek | ETH (Ethereum), BNB | **$WLAB** (Base üzerinde ERC-20) |
| Gas ödemesi | Evet (native) | Hayır (WLAB ile gas ödenmez; ETH/Base ETH ödenir) |

**WhiteLab:** $WLAB bir **utility token**'dır; Base'in native coin'i ETH (gas) ile karıştırılmamalıdır.

**Bölüm özeti:** WLAB = token. **Sonraki adım:** Katman mimarisi.

---

## 0.3 Layer 1 / Layer 2 / Layer 3

| Katman | Rol | WhiteLab |
|--------|-----|----------|
| **L1** | Temel güvenlik ve finalite (Ethereum) | WhiteLab güvenliği Ethereum L1'e dayanır |
| **L2** | L1'e batch submit; düşük maliyet (Base) | **Birincil deployment** — IDO, staking, governance |
| **L3** | Uygulama-spesifik ölçekleme | Gelecek: app-chain veya özel rollup (yol haritası Y3) |

**Bölüm özeti:** WhiteLab ana omurga = Base (L2). **Sonraki adım:** EVM ekosistemi.

---

## 0.4 EVM Uyumlu Zincirler

**EVM** (Ethereum Virtual Machine), Solidity bytecode'un çalıştığı standarttır. WhiteLab sözleşmeleri EVM uyumludur; taşınabilirlik LayerZero OFT ile genişler.

| Zincir | WhiteLab kullanımı |
|--------|-------------------|
| Ethereum | Güven referansı, oracle |
| **Base** | **Ana ağ** — deploy, likidite, DAO |
| BNB Chain | Faz 2 OFT |
| Polygon | Faz 2 OFT |
| Avalanche | DeFi entegrasyon roadmap |
| Arbitrum | Faz 2 OFT |

**Bölüm özeti:** Tek kod tabanı, çoklu zincir köprüsü. **Sonraki adım:** Gas ekonomisi.

---

## 0.5 Gas, Gas Limit, Gas Price

- **Gas:** İşlem maliyet birimi (hesaplama + depolama).
- **Gas limit:** Bir işlemde harcanabilecek maksimum gas.
- **Gas price:** Birim gas başına ücret (gwei).

**WhiteLab örneği:** IDO katılımı ~150k–300k gas; Base'de Ethereum mainnet'e göre ~10–50x daha ucuz. Launch ücretlerinin bir kısmı protocol fee olarak treasury'ye gider.

**Bölüm özeti:** Kullanıcı ETH ile gas öder; protokol WLAB ile hizmet alır. **Sonraki adım:** Cüzdan kriptografisi.

---

## 0.6 Public Key / Private Key / Wallet

| Bileşen | Açıklama |
|---------|----------|
| **Private key** | 32 byte gizli anahtar — asla paylaşılmaz |
| **Public key** | Private key'den türetilir |
| **Address** | Public key'in hash'i (0x...) — cüzdan kimliği |

**WhiteLab:** Whitelist/KYC, staking, governance oyları **address** bazlıdır. Kurumsal kullanıcılar multisig (Gnosis Safe) kullanır.

**Bölüm özeti:** Anahtar güvenliği = varlık güvenliği. **Sonraki adım:** Akıllı sözleşmeler.

---

## 0.7 Smart Contract

**Akıllı sözleşme**, zincir üzerinde otomatik çalışan programdır. WhiteLab stack'i:

- `WLABToken` — transfer, fee, compliance
- `WLABVesting` — kilitli dağıtım
- `WLABStaking` — ödül
- `WLABGovernor` — DAO
- `WLABTokenSale` — IDO

**Bölüm özeti:** İş kuralları kodda, şeffaf ve denetlenebilir. **Sonraki adım:** ABI ve bytecode.

---

## 0.8 ABI ve Bytecode

| Kavram | Açıklama |
|--------|----------|
| **Bytecode** | Derlenmiş sözleşme (EVM makine kodu) |
| **ABI** | Frontend/wallet'ın fonksiyon çağrısı için JSON arayüzü |

**WhiteLab:** Deploy sonrası ABI `artifacts/` altında; subgraph ve SDK bu ABI'yi kullanır. Basescan verify bytecode'u kaynak kodla eşleştirir.

**Bölüm özeti:** ABI = API sözleşmesi. **Sonraki adım:** DeFi.

---

## 0.9 DeFi Temel Bileşenleri

| Bileşen | İşlev | WhiteLab entegrasyonu |
|---------|-------|----------------------|
| **DEX (AMM)** | Token takası | Uniswap v3 WLAB/ETH havuzu |
| **Lending** | Borç/teminat | Aave collateral roadmap (Bölüm 8) |
| **Staking** | Kilitle → ödül | `WLABStaking` native |
| **Governance** | Token ile oy | `WLABGovernor` + timelock |
| **Bridge** | Zincirler arası | LayerZero OFT |
| **Oracle** | Dış fiyat verisi | Chainlink ETH/USD |

**Bölüm özeti:** WhiteLab hem launch altyapısı hem DeFi lego'su ile konuşur.

---

## BÖLÜM 0 — Bölüm Özeti & Sonraki Adım

Blockchain temelleri WhiteLab Launch OS'e oturtuldu: Base L2 üzerinde ERC-20 utility token, akıllı sözleşme modülleri ve DeFi entegrasyon yolu.

**Sonraki adım:** [Bölüm 1 — Proje Kimliği ve Strateji](./01-identity-strategy.md)
