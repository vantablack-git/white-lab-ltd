const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

//
// ─── Security Audit: Adversarial Test Suite ──────────────────────────────────
//
// Every test models a realistic hostile interaction pattern and explicitly
// classifies the attacked surface as:
//
//   - PROTECTED            → invariant holds under attack
//   - VULNERABLE-BY-DESIGN → contract assumes a well-behaved external token
//   - PARTIALLY PROTECTED  → limited protection (e.g. role-based only)
//

describe("Security Audit", function () {
  let owner, attacker, user, treasury;

  before(async function () {
    [owner, attacker, user, treasury] = await ethers.getSigners();
  });

  function encodeCall(contract, fn, args = []) {
    return contract.interface.encodeFunctionData(fn, args);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Treasury — Malicious ERC20 reentrancy during withdraw
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  TreasuryUUPS.withdraw has no nonReentrant guard.  Only
  //                  SPENDER_ROLE is checked.
  //
  // Exploit:         A malicious ERC20 fires a callback during transfer that
  //                  re-enters withdraw.  The reentrant call's msg.sender is
  //                  the malicious token address (not the original SPENDER),
  //                  so onlyRole(SPENDER_ROLE) blocks it.  However, if the
  //                  SPENDER were itself a contract that called a malicious
  //                  token whose callback could somehow retain the original
  //                  caller's identity, the attack would succeed.
  //
  // Classification:  PARTIALLY PROTECTED — blocked by role check on msg.sender,
  //                  which changes during the callback.  No nonReentrant guard.
  //                  A determined SPENDER could self-DoS or, if the token's
  //                  callback used delegatecall to the treasury impl, bypass
  //                  the role check (extremely unlikely in practice).

  describe("Treasury — ERC20 reentrancy (PARTIALLY PROTECTED)", function () {
    it("reentrant withdraw is blocked by onlyRole because msg.sender is the token", async function () {
      const Token = await ethers.getContractFactory("ReentrantERC20");
      const maliciousToken = await Token.deploy("MAL", "MAL");

      const Treasury = await ethers.getContractFactory("WLABTreasuryUUPS");
      const impl = await Treasury.deploy();
      const initData = Treasury.interface.encodeFunctionData("initialize", [owner.address]);
      const Proxy = await ethers.getContractFactory("WLABERC1967Proxy");
      const proxy = await Proxy.deploy(await impl.getAddress(), initData);
      const treasury = Treasury.attach(await proxy.getAddress());

      await treasury.connect(owner).grantRole(await treasury.SPENDER_ROLE(), attacker.address);

      const AMOUNT = ethers.parseEther("500");
      await maliciousToken.mint(await treasury.getAddress(), AMOUNT * 10n);

      const callbackData = encodeCall(treasury, "withdraw", [
        await maliciousToken.getAddress(),
        attacker.address,
        AMOUNT,
      ]);
      await maliciousToken.setCallback(await treasury.getAddress(), callbackData);

      const balBefore = await maliciousToken.balanceOf(attacker.address);

      // The reentrant call is blocked by onlyRole(SPENDER_ROLE) because
      // msg.sender during the callback is the malicious token, not the attacker.
      await expect(
        treasury.connect(attacker).withdraw(await maliciousToken.getAddress(), attacker.address, AMOUNT)
      ).to.be.reverted;

      // State is consistent — no tokens leaked.
      const balAfter = await maliciousToken.balanceOf(attacker.address);
      expect(balAfter - balBefore).to.equal(0);

      // The first _debit already happened before the callback, but the entire
      // outer tx reverted, so the treasury balance is unchanged.
      expect(await maliciousToken.balanceOf(await treasury.getAddress())).to.equal(AMOUNT * 10n);
    });

    it("withdraw works normally without callback", async function () {
      const Token = await ethers.getContractFactory("WLABToken");
      const normalToken = await Token.deploy(owner.address, treasury.address);

      const Treasury = await ethers.getContractFactory("WLABTreasuryUUPS");
      const impl2 = await Treasury.deploy();
      const initData2 = Treasury.interface.encodeFunctionData("initialize", [owner.address]);
      const Proxy2 = await ethers.getContractFactory("WLABERC1967Proxy");
      const proxy2 = await Proxy2.deploy(await impl2.getAddress(), initData2);
      const treasury2 = Treasury.attach(await proxy2.getAddress());

      await treasury2.connect(owner).grantRole(await treasury2.SPENDER_ROLE(), attacker.address);

      const AMOUNT = ethers.parseEther("100");
      await normalToken.connect(owner).mint(await treasury2.getAddress(), AMOUNT);

      await treasury2.connect(attacker).withdraw(await normalToken.getAddress(), user.address, AMOUNT);
      expect(await normalToken.balanceOf(user.address)).to.equal(AMOUNT);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LockVault — Malicious ERC20 reentrancy
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  createLock has a CEI violation (safeTransferFrom before
  //                  state update), but uses nonReentrant.
  // Exploit:         A malicious WLAB token's transferFrom calls back into
  //                  createLock or withdraw.  nonReentrant blocks the inner
  //                  call, but the callback sees `ok = false` and our mock
  //                  token's require(ok) fires, swallowing the real error.
  // Classification:  PROTECTED (nonReentrant)

  describe("LockVault — malicious WLAB reentrancy (PROTECTED)", function () {
    it("nonReentrant blocks recursive createLock", async function () {
      const Token = await ethers.getContractFactory("ReentrantERC20");
      const maliciousWlab = await Token.deploy("MWL", "MWL");

      const LockVault = await ethers.getContractFactory("WLABLockVault");
      const vault = await LockVault.deploy(await maliciousWlab.getAddress(), owner.address);

      const AMOUNT = ethers.parseEther("100");
      await maliciousWlab.mint(user.address, AMOUNT);
      await maliciousWlab.connect(user).approve(await vault.getAddress(), AMOUNT);

      const callbackData = encodeCall(vault, "createLock", [AMOUNT, 30 * 24 * 60 * 60]);
      await maliciousWlab.setCallback(await vault.getAddress(), callbackData);

      await expect(
        vault.connect(user).createLock(AMOUNT, 30 * 24 * 60 * 60)
      ).to.be.reverted;

      // Verify no state corruption: user has no lock.
      expect(await vault.lockCount(user.address)).to.equal(0);
    });

    it("nonReentrant blocks recursive withdraw", async function () {
      const Token = await ethers.getContractFactory("ReentrantERC20");
      const maliciousWlab = await Token.deploy("MWL2", "MWL2");

      const LockVault = await ethers.getContractFactory("WLABLockVault");
      const vault = await LockVault.deploy(await maliciousWlab.getAddress(), owner.address);

      const AMOUNT = ethers.parseEther("100");
      const SHORT_LOCK = 7n * 24n * 60n * 60n;
      await maliciousWlab.mint(user.address, AMOUNT);
      await maliciousWlab.connect(user).approve(await vault.getAddress(), AMOUNT);

      await vault.connect(user).createLock(AMOUNT, SHORT_LOCK);
      await time.increase(SHORT_LOCK + 1n);

      const callbackData = encodeCall(vault, "withdraw", [0]);
      await maliciousWlab.setCallback(await vault.getAddress(), callbackData);

      await expect(
        vault.connect(user).withdraw(0)
      ).to.be.reverted;

      // Lock still exists — state not corrupted.
      expect(await vault.lockCount(user.address)).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Staking — Reward token callback reentrancy
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  _harvest calls rewardToken.safeTransfer(user, pending)
  //                  inside nonReentrant functions (claimReward, stake, unstake,
  //                  emergencyUnstake).
  // Exploit:         Malicious reward token re-enters claimReward or stake
  //                  during reward payout.  nonReentrant blocks the inner call.
  // Classification:  PROTECTED (nonReentrant)

  describe("Staking — reward token callback reentrancy (PROTECTED)", function () {
    async function setupStakingWithMaliciousReward(owner, user, treasury) {
      const StakingToken = await ethers.getContractFactory("WLABToken");
      const stakingToken = await StakingToken.deploy(owner.address, treasury.address);

      const RewardToken = await ethers.getContractFactory("ReentrantERC20");
      const rewardToken = await RewardToken.deploy("RWD", "RWD");

      const Staking = await ethers.getContractFactory("WLABStaking");
      const staking = await Staking.deploy(
        await stakingToken.getAddress(),
        await rewardToken.getAddress(),
        owner.address
      );

      const REWARD = ethers.parseEther("50000");
      await rewardToken.mint(await staking.getAddress(), REWARD);

      const RATE = ethers.parseEther("1") / 86400n;
      await staking.connect(owner).setRewardProgram(RATE, 7 * 24 * 60 * 60);

      const STAKE_AMT = ethers.parseEther("1000");
      await stakingToken.connect(owner).mint(user.address, STAKE_AMT);
      await stakingToken.connect(user).approve(await staking.getAddress(), STAKE_AMT);
      await staking.connect(user).stake(STAKE_AMT, 0, false);

      await time.increase(7 * 24 * 60 * 60);

      return { staking, rewardToken, stakingToken };
    }

    it("nonReentrant blocks recursive claimReward via reward token", async function () {
      const { staking, rewardToken } = await setupStakingWithMaliciousReward(owner, user, treasury);

      const callbackData = encodeCall(staking, "claimReward", []);
      await rewardToken.setCallback(await staking.getAddress(), callbackData);

      await expect(
        staking.connect(user).claimReward()
      ).to.be.reverted;

      // State check: reward debt unchanged because claimReward reverted.
      const info = await staking.stakes(user.address);
      const pending = await staking.pendingReward(user.address);
      expect(pending).to.be.gt(0); // rewards still pending
    });

    it("nonReentrant blocks recursive emergencyUnstake via reward token", async function () {
      const { staking, rewardToken } = await setupStakingWithMaliciousReward(owner, user, treasury);

      const callbackData = encodeCall(staking, "emergencyUnstake", []);
      await rewardToken.setCallback(await staking.getAddress(), callbackData);

      await expect(
        staking.connect(user).emergencyUnstake()
      ).to.be.reverted;

      // State not corrupted — user still has stake.
      const info = await staking.stakes(user.address);
      expect(info.amount).to.be.gt(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LockVault — Fee-on-transfer token accounting desync
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  createLock records `amount` as the lock principal, but if
  //                  the vault token takes a fee on transfer, the vault receives
  //                  less than `amount`.  On withdrawal, the vault tries to send
  //                  the full recorded amount but cannot — user's tokens are
  //                  permanently stuck.
  // Classification:  VULNERABLE-BY-DESIGN (assumes non-fee-on-transfer WLAB)

  describe("LockVault — fee-on-transfer token accounting (VULNERABLE-BY-DESIGN)", function () {
    it("locks record inflated amount and withdraw reverts — tokens are stuck", async function () {
      const Token = await ethers.getContractFactory("FeeOnTransferERC20");
      const feeToken = await Token.deploy("FEE", "FEE");
      const FEE_BPS = 100; // 1%
      await feeToken.setFee(FEE_BPS, treasury.address);

      const LockVault = await ethers.getContractFactory("WLABLockVault");
      const vault = await LockVault.deploy(await feeToken.getAddress(), owner.address);

      const AMOUNT = ethers.parseEther("1000");
      await feeToken.mint(user.address, AMOUNT);
      await feeToken.connect(user).approve(await vault.getAddress(), AMOUNT);

      await vault.connect(user).createLock(AMOUNT, 30 * 24 * 60 * 60);

      const userLock = await vault.locks(user.address, 0);
      expect(userLock.amount).to.equal(AMOUNT);

      const vaultBal = await feeToken.balanceOf(await vault.getAddress());
      expect(vaultBal).to.be.lt(AMOUNT);

      await time.increase(30 * 24 * 60 * 60 + 1);

      await expect(
        vault.connect(user).withdraw(0)
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Staking — Fee-on-transfer staking token accounting desync
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  stake records `s.amount += amount`, but only receives
  //                  `amount - fee` due to a fee-on-transfer staking token.
  //                  unstake tries to send the full recorded amount and reverts.
  // Classification:  VULNERABLE-BY-DESIGN (assumes non-fee-on-transfer staking
  //                  token)

  describe("Staking — fee-on-transfer staking token (VULNERABLE-BY-DESIGN)", function () {
    it("fee desync lets user steal from reward backing on unstake", async function () {
      const FeeToken = await ethers.getContractFactory("FeeOnTransferERC20");
      const feeToken = await FeeToken.deploy("FSTK", "FSTK");
      const FEE_BPS = 5000; // 50% fee — dramatic effect
      await feeToken.setFee(FEE_BPS, treasury.address);

      const Staking = await ethers.getContractFactory("WLABStaking");
      const staking = await Staking.deploy(
        await feeToken.getAddress(),
        await feeToken.getAddress(),
        owner.address
      );

      const AMOUNT = ethers.parseEther("1000");
      const FEE = (AMOUNT * BigInt(FEE_BPS)) / 10000n;
      const NET = AMOUNT - FEE;

      await feeToken.mint(user.address, AMOUNT);
      await feeToken.connect(user).approve(await staking.getAddress(), AMOUNT);

      // Stake — contract records AMOUNT but receives only NET.
      await staking.connect(user).stake(AMOUNT, 0, false);

      const info = await staking.stakes(user.address);
      expect(info.amount).to.equal(AMOUNT);

      // Contract's actual balance is NET (no reward backing funded yet).
      const vaultBal = await feeToken.balanceOf(await staking.getAddress());
      expect(vaultBal).to.equal(NET);

      // totalStaked is inflated by the fee.
      expect(await staking.totalStaked()).to.equal(AMOUNT);

      // _rewardBackingBalance() returns max(0, balance - totalStaked) when
      // stakingToken == rewardToken.  Since balance = NET < AMOUNT = totalStaked,
      // reward backing = 0.  A reward program would be unreachable unless the
      // owner funds more tokens.
      const lockDuration = await staking.lockDurations(0);

      // Owner must fund the contract or else reserve checks fail.
      const BACKING = ethers.parseEther("500000");
      await feeToken.mint(await staking.getAddress(), BACKING);

      await staking.connect(owner).setRewardRate(0);

      await time.increase(Number(lockDuration) + 1);

      // User unstakes the recorded AMOUNT, but the fee-on-transfer token also
      // deducts FEE on the outgoing transfer, so the user only receives NET.
      await staking.connect(user).unstake(AMOUNT);

      const userBal = await feeToken.balanceOf(user.address);
      expect(userBal).to.equal(NET);

      // Reward backing pool was silently depleted by the fee.
      // balance = BACKING + NET (from stake) - AMOUNT (safeTransfer debited)
      //         = BACKING - FEE
      expect(await feeToken.balanceOf(await staking.getAddress())).to.equal(BACKING - FEE);

      // net reward backing = max(0, balance - totalStaked)
      //                    = BACKING - FEE  (since totalStaked = 0 after unstake)
      // The owner funded BACKING but FEE was lost to the treasury.
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TokenSale — Fee-on-transfer ERC20 payment token refund
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  When the payment token takes a fee on transfer, buy()
  //                  records totalRaisedWei += paymentRequired but the contract
  //                  only holds `paymentRequired - fee`.  When a phase fails and
  //                  users call refund(), the contract tries to send the full
  //                  recorded amount but cannot.
  // Classification:  VULNERABLE-BY-DESIGN (assumes non-fee-on-transfer payment
  //                  token)

  describe("TokenSale — fee-on-transfer payment token (VULNERABLE-BY-DESIGN)", function () {
    it("refund reverts when payment token takes a transfer fee", async function () {
      const FeeToken = await ethers.getContractFactory("FeeOnTransferERC20");
      const paymentToken = await FeeToken.deploy("USDF", "USDF");
      const FEE_BPS = 100; // 1%
      await paymentToken.setFee(FEE_BPS, treasury.address);

      const SaleToken = await ethers.getContractFactory("WLABToken");
      const saleToken = await SaleToken.deploy(owner.address, treasury.address);

      const Sale = await ethers.getContractFactory("WLABTokenSale");
      const sale = await Sale.deploy(
        await saleToken.getAddress(),
        await paymentToken.getAddress(),
        owner.address
      );

      const PRICE = ethers.parseEther("1"); // 1 payment token per sale token
      const ALLOCATION = ethers.parseEther("10000");
      const HARD_CAP = ethers.parseEther("10000");
      const SOFT_CAP = ethers.parseEther("10000"); // = hard cap, impossible to meet

      await sale.connect(owner).configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0);
      await sale.connect(owner).startPhase(3);

      const BUY_AMT = ethers.parseEther("500");
      const PAYMENT = (BUY_AMT * PRICE) / ethers.parseEther("1"); // = 500 payment tokens

      await paymentToken.mint(user.address, PAYMENT * 2n);
      await paymentToken.connect(user).approve(await sale.getAddress(), PAYMENT);

      await sale.connect(user).buy(BUY_AMT, []);

      // Finalize — soft cap 10000 >> raised 500 → refund enabled.
      await sale.connect(owner).finalizePhase(3);
      expect(await sale.phaseRefundsEnabled(3)).to.equal(true);

      // Refund tries to send PAYMENT but the contract only has PAYMENT - 1% → reverts.
      await expect(
        sale.connect(user).refund(3)
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. TokenSale — ETH refund reentrancy
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  refund sends ETH via `msg.sender.call{value: paid}("")`.
  //                  The state (purchasedWei, purchasedTokens, etc.) is cleared
  //                  BEFORE the ETH transfer (CEI compliant).
  // Exploit:         Buyer contract's receive() calls back into refund() for the
  //                  same phase.  The reentrant call finds purchasedWei already
  //                  zeroed and reverts with "Sale: nothing to refund".
  // Classification:  PROTECTED (CEI — state cleared before external call)

  describe("TokenSale — ETH refund reentrancy (PROTECTED)", function () {
    it("reentrant refund reverts because purchasedWei was already zeroed", async function () {
      const SaleToken = await ethers.getContractFactory("WLABToken");
      const saleToken = await SaleToken.deploy(owner.address, treasury.address);

      const Sale = await ethers.getContractFactory("WLABTokenSale");
      const sale = await Sale.deploy(
        await saleToken.getAddress(),
        ethers.ZeroAddress,
        owner.address
      );

      const PRICE = ethers.parseEther("0.00004");
      const ALLOCATION = ethers.parseEther("100000");
      const HARD_CAP = ethers.parseEther("100");
      const SOFT_CAP = ethers.parseEther("100"); // impossible to meet

      await sale.connect(owner).configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0);
      await sale.connect(owner).startPhase(3);

      await saleToken.connect(owner).mint(await sale.getAddress(), ethers.parseEther("1000000"));

      const Receiver = await ethers.getContractFactory("ReentrantReceiver");
      const receiver = await Receiver.deploy();

      const BUY_AMT = ethers.parseEther("500");
      const COST = (BUY_AMT * PRICE) / ethers.parseEther("1");
      const GAS_ETH = ethers.parseEther("1");

      // Fund receiver with enough ETH for gas + purchase.
      await owner.sendTransaction({ to: await receiver.getAddress(), value: COST + GAS_ETH });

      // Buy as the receiver contract via impersonation.
      const receiverSigner = await ethers.getImpersonatedSigner(await receiver.getAddress());
      await sale.connect(receiverSigner).buy(BUY_AMT, [], { value: COST });

      await sale.connect(owner).finalizePhase(3);

      const callbackData = encodeCall(sale, "refund", [3]);
      await receiver.setReentrancy(await sale.getAddress(), callbackData, 1);

      const balBefore = await ethers.provider.getBalance(await receiver.getAddress());

      // The reentrant refund call reverts (purchasedWei already zeroed),
      // which causes the outer .call{value} to return false, which causes
      // require(ok, "Sale: eth refund fail") to revert the entire tx.
      await expect(
        sale.connect(receiverSigner).refund(3)
      ).to.be.reverted;

      // State is consistent after revert: purchasedWei unchanged.
      expect(await sale.purchasedWei(3, await receiver.getAddress())).to.equal(COST);
      expect(await sale.purchasedTokens(3, await receiver.getAddress())).to.equal(BUY_AMT);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. TokenSale — withdrawFunds ETH reentrancy
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  withdrawFunds sets withdrawableRaisedWei = 0 BEFORE
  //                  sending ETH (CEI compliant).
  // Exploit:         Recipient's receive() calls back into withdrawFunds.
  //                  The reentrant call finds withdrawableRaisedWei = 0 and
  //                  reverts with "Sale: nothing to withdraw".
  // Classification:  PROTECTED (CEI — zeroed before external call)

  describe("TokenSale — withdrawFunds reentrancy (PROTECTED)", function () {
    it("reentrant withdrawFunds reverts because balance is already zeroed", async function () {
      const SaleToken = await ethers.getContractFactory("WLABToken");
      const saleToken = await SaleToken.deploy(owner.address, treasury.address);

      const Sale = await ethers.getContractFactory("WLABTokenSale");
      const sale = await Sale.deploy(
        await saleToken.getAddress(),
        ethers.ZeroAddress,
        owner.address
      );

      const PRICE = ethers.parseEther("0.00004");
      const ALLOCATION = ethers.parseEther("100000");
      const HARD_CAP = ethers.parseEther("100");
      const SOFT_CAP = ethers.parseEther("0.01");

      await sale.connect(owner).configurePhase(3, PRICE, ALLOCATION, HARD_CAP, SOFT_CAP, ethers.ZeroHash, 0);
      await sale.connect(owner).startPhase(3);

      await saleToken.connect(owner).mint(await sale.getAddress(), ethers.parseEther("1000000"));

      const BUY_AMT = ethers.parseEther("500");
      const COST = (BUY_AMT * PRICE) / ethers.parseEther("1");

      await sale.connect(user).buy(BUY_AMT, [], { value: COST });
      await sale.connect(owner).finalizePhase(3);
      await sale.connect(owner).finalizeSale();

      expect(await sale.withdrawableRaisedWei()).to.equal(COST);

      const Receiver = await ethers.getContractFactory("ReentrantReceiver");
      const receiver = await Receiver.deploy();

      const callbackData = encodeCall(sale, "withdrawFunds", [await receiver.getAddress()]);
      await receiver.setReentrancy(await sale.getAddress(), callbackData, 1);

      const balBefore = await ethers.provider.getBalance(await receiver.getAddress());

      // The reentrant call reverts (withdrawableRaisedWei already zeroed),
      // which causes the outer .call{value} to return false, which causes
      // require(ok, "Sale: withdraw fail") to revert the entire tx.
      await expect(
        sale.connect(owner).withdrawFunds(await receiver.getAddress())
      ).to.be.reverted;

      // State is consistent after revert: no funds moved, balance intact.
      const balAfter = await ethers.provider.getBalance(await receiver.getAddress());
      expect(balAfter - balBefore).to.equal(0);
      expect(await sale.withdrawableRaisedWei()).to.equal(COST);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Vesting — Malicious token reentrancy
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  release and revoke both use nonReentrant AND follow CEI.
  // Exploit:         Malicious vested token calls back into release or revoke
  //                  during safeTransfer.  nonReentrant blocks the inner call.
  // Classification:  PROTECTED (nonReentrant + CEI)

  describe("Vesting — malicious token reentrancy (PROTECTED)", function () {
    it("nonReentrant blocks recursive release", async function () {
      const Token = await ethers.getContractFactory("ReentrantERC20");
      const maliciousToken = await Token.deploy("MVST", "MVST");

      const Vesting = await ethers.getContractFactory("WLABVesting");
      const vesting = await Vesting.deploy(await maliciousToken.getAddress(), owner.address);

      const AMOUNT = ethers.parseEther("1000");
      const NOW = BigInt(await time.latest());
      const DURATION = 1000n;

      await maliciousToken.mint(owner.address, AMOUNT);
      await maliciousToken.connect(owner).approve(await vesting.getAddress(), AMOUNT);
      await vesting.connect(owner).createSchedule(user.address, AMOUNT, NOW, 0, DURATION, true);
      await time.increaseTo(NOW + DURATION + 1n);

      const callbackData = encodeCall(vesting, "release", []);
      await maliciousToken.setCallback(await vesting.getAddress(), callbackData);

      await expect(
        vesting.connect(user).release()
      ).to.be.reverted;

      // State not corrupted.
      expect(await vesting.releasableAmount(user.address)).to.be.gt(0);
    });

    it("nonReentrant blocks recursive revoke", async function () {
      const Token = await ethers.getContractFactory("ReentrantERC20");
      const maliciousToken = await Token.deploy("MVST2", "MVST2");

      const Vesting = await ethers.getContractFactory("WLABVesting");
      const vesting = await Vesting.deploy(await maliciousToken.getAddress(), owner.address);

      const AMOUNT = ethers.parseEther("1000");
      const NOW = BigInt(await time.latest());
      const CLIFF = 1000n;
      const DURATION = 1000n;

      await maliciousToken.mint(owner.address, AMOUNT);
      await maliciousToken.connect(owner).approve(await vesting.getAddress(), AMOUNT);
      await vesting.connect(owner).createSchedule(user.address, AMOUNT, NOW, CLIFF, DURATION, true);

      const callbackData = encodeCall(vesting, "revoke", [user.address]);
      await maliciousToken.setCallback(await vesting.getAddress(), callbackData);

      await expect(
        vesting.connect(owner).revoke(user.address)
      ).to.be.reverted;

      // Schedule still exists and is before cliff, so nothing vested.
      expect(await vesting.releasableAmount(user.address)).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Staking — Cross-function state desync: reward program change mid-flow
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  A user's pendingReward is calculated at the current
  //                  rewardRatePerSecond.  The owner changes the rate between
  //                  _updatePool calls.
  // Classification:  PROTECTED — _updatePool snapshots accrued rewards before
  //                  any rate change.

  describe("Staking — cross-function state desync (PROTECTED)", function () {
    it("rate change mid-flow does not corrupt pending reward accounting", async function () {
      const Token = await ethers.getContractFactory("WLABToken");
      const stakingToken = await Token.deploy(owner.address, treasury.address);

      const Staking = await ethers.getContractFactory("WLABStaking");
      const staking = await Staking.deploy(
        await stakingToken.getAddress(),
        await stakingToken.getAddress(),
        owner.address
      );

      await stakingToken.connect(owner).mint(owner.address, ethers.parseEther("1000000"));
      await stakingToken.connect(owner).mint(user.address, ethers.parseEther("10000"));
      await stakingToken.connect(owner).transfer(await staking.getAddress(), ethers.parseEther("500000"));
      await staking.connect(owner).setRewardRate(ethers.parseEther("1") / 86400n);

      await stakingToken.connect(user).approve(await staking.getAddress(), ethers.parseEther("10000"));
      await staking.connect(user).stake(ethers.parseEther("100"), 0, false);

      await time.increase(3 * 24 * 60 * 60);
      const pendingBefore = await staking.pendingReward(user.address);

      await staking.connect(owner).setRewardRate(ethers.parseEther("1") / 8640000n);

      const pendingAfter = await staking.pendingReward(user.address);
      expect(pendingAfter).to.be.gte(pendingBefore);

      await staking.connect(user).claimReward();
      expect(await staking.pendingReward(user.address)).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Proxy — Implementation initialization protection
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  UUPS implementation's initialize() called directly, or
  //                  proxy initialized twice.
  // Classification:  PROTECTED (_disableInitializers in constructor, plus
  //                  initializer modifier)

  describe("Proxy — initialization guard (PROTECTED)", function () {
    it("implementation cannot be initialized directly", async function () {
      const Treasury = await ethers.getContractFactory("WLABTreasuryUUPS");
      const impl = await Treasury.deploy();
      await expect(
        impl.initialize(owner.address)
      ).to.be.reverted;
    });

    it("proxy cannot be re-initialized", async function () {
      const Treasury = await ethers.getContractFactory("WLABTreasuryUUPS");
      const impl = await Treasury.deploy();
      const initData = Treasury.interface.encodeFunctionData("initialize", [owner.address]);
      const Proxy = await ethers.getContractFactory("WLABERC1967Proxy");
      const proxy = await Proxy.deploy(await impl.getAddress(), initData);
      const treasury = Treasury.attach(await proxy.getAddress());

      await expect(
        treasury.connect(owner).initialize(owner.address)
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. TokenSale — Cross-phase claim/refund isolation
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Attack surface:  A buyer buys in both a successful and a failed phase.
  //                  Can they claim the successful phase after refunding the
  //                  failed one?
  // Classification:  PROTECTED (per-phase refund latch)

  describe("TokenSale — cross-phase claim/refund isolation (PROTECTED)", function () {
    it("buyer can claim successful phase while another phase refunds", async function () {
      const SaleToken = await ethers.getContractFactory("WLABToken");
      const saleToken = await SaleToken.deploy(owner.address, treasury.address);

      const Sale = await ethers.getContractFactory("WLABTokenSale");
      const sale = await Sale.deploy(
        await saleToken.getAddress(),
        ethers.ZeroAddress,
        owner.address
      );

      const PRICE = ethers.parseEther("0.00004");
      const ALLOCATION = ethers.parseEther("100000");
      const HARD_CAP = ethers.parseEther("100");
      const LOW_SOFT_CAP = ethers.parseEther("0.001"); // success
      const HIGH_SOFT_CAP = HARD_CAP; // 100 ETH — far more than we raise → fail

      await saleToken.connect(owner).mint(await sale.getAddress(), ethers.parseEther("1000000"));

      await sale.connect(owner).configurePhase(1, PRICE, ALLOCATION, HARD_CAP, LOW_SOFT_CAP, ethers.ZeroHash, 0);
      await sale.connect(owner).configurePhase(2, PRICE, ALLOCATION, HARD_CAP, HIGH_SOFT_CAP, ethers.ZeroHash, 0);

      await sale.connect(owner).startPhase(1);
      const BUY_AMT = ethers.parseEther("500");
      const COST = (BUY_AMT * PRICE) / ethers.parseEther("1");
      await sale.connect(user).buy(BUY_AMT, [], { value: COST });
      await sale.connect(owner).finalizePhase(1);

      await sale.connect(owner).startPhase(2);
      const BUY_AMT2 = ethers.parseEther("100");
      const COST2 = (BUY_AMT2 * PRICE) / ethers.parseEther("1");
      await sale.connect(user).buy(BUY_AMT2, [], { value: COST2 });
      await sale.connect(owner).finalizePhase(2);

      await sale.connect(owner).finalizeSale();

      const balBefore = await saleToken.balanceOf(user.address);
      await sale.connect(user).claim(1);
      const balAfter = await saleToken.balanceOf(user.address);
      expect(balAfter - balBefore).to.equal(BUY_AMT);

      const ethBefore = await ethers.provider.getBalance(user.address);
      await sale.connect(user).refund(2);
      const ethAfter = await ethers.provider.getBalance(user.address);
      expect(ethAfter - ethBefore).to.be.closeTo(COST2, ethers.parseEther("0.01"));

      expect(await sale.totalUnclaimedTokens()).to.equal(0);
    });
  });
});
