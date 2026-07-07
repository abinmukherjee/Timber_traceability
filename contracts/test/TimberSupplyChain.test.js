// test/TimberSupplyChain.test.js
// Full test suite for TimberSupplyChain.sol
// Covers all 17 required scenarios plus a full end-to-end provenance chain test.

const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("TimberSupplyChain", function () {
  let contract;
  let deployer, auctionHouse, factory, unauthorized, factory2;

  // Role hashes (keccak256 — must match contract constants)
  let AUCTION_HOUSE_ROLE;
  let FACTORY_ROLE;
  let DEFAULT_ADMIN_ROLE;

  // Shared test lot parameters
  const LOT_SPECIES   = "Teak";
  const LOT_COUPE     = "KA-2024-001";
  const LOT_GRADE     = "Grade A";
  const LOT_QTY       = 2000n;
  const LOT_IPFS      = "QmTestCID123";

  before(async function () {
    [deployer, auctionHouse, factory, unauthorized, factory2] = await ethers.getSigners();

    const TimberSupplyChain = await ethers.getContractFactory("TimberSupplyChain");
    contract = await TimberSupplyChain.deploy();
    await contract.waitForDeployment();

    AUCTION_HOUSE_ROLE = await contract.AUCTION_HOUSE_ROLE();
    FACTORY_ROLE       = await contract.FACTORY_ROLE();
    DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Role setup & admin control
  // ───────────────────────────────────────────────────────────────────────────

  describe("Role initialisation", function () {
    it("deployer has DEFAULT_ADMIN_ROLE", async function () {
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
    });

    it("deployer can grant AUCTION_HOUSE_ROLE to another address", async function () {
      await expect(contract.connect(deployer).grantRole(AUCTION_HOUSE_ROLE, auctionHouse.address))
        .to.emit(contract, "RoleGranted")
        .withArgs(AUCTION_HOUSE_ROLE, auctionHouse.address, deployer.address);

      expect(await contract.hasRole(AUCTION_HOUSE_ROLE, auctionHouse.address)).to.be.true;
    });

    it("deployer can grant FACTORY_ROLE to another address", async function () {
      await expect(contract.connect(deployer).grantRole(FACTORY_ROLE, factory.address))
        .to.emit(contract, "RoleGranted")
        .withArgs(FACTORY_ROLE, factory.address, deployer.address);

      expect(await contract.hasRole(FACTORY_ROLE, factory.address)).to.be.true;
    });

    it("also grant FACTORY_ROLE to factory2 for batch-ownership tests", async function () {
      await contract.connect(deployer).grantRole(FACTORY_ROLE, factory2.address);
      expect(await contract.hasRole(FACTORY_ROLE, factory2.address)).to.be.true;
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. registerLot()
  // ───────────────────────────────────────────────────────────────────────────

  describe("registerLot()", function () {
    it("succeeds when called by AUCTION_HOUSE_ROLE wallet", async function () {
      const tx = await contract
        .connect(auctionHouse)
        .registerLot(LOT_SPECIES, LOT_COUPE, LOT_GRADE, LOT_QTY, LOT_IPFS);

      await expect(tx)
        .to.emit(contract, "LotRegistered")
        .withArgs(1n, auctionHouse.address, LOT_QTY, (v) => typeof v === "bigint");

      const lot = await contract.getLot(1);
      expect(lot.id).to.equal(1n);
      expect(lot.species).to.equal(LOT_SPECIES);
      expect(lot.originCoupeId).to.equal(LOT_COUPE);
      expect(lot.grade).to.equal(LOT_GRADE);
      expect(lot.initialQty).to.equal(LOT_QTY);
      expect(lot.remainingQty).to.equal(LOT_QTY);
      expect(lot.owner).to.equal(auctionHouse.address);
      expect(lot.ipfsHash).to.equal(LOT_IPFS);
    });

    it("reverts when called by non-AUCTION_HOUSE_ROLE wallet", async function () {
      await expect(
        contract.connect(unauthorized).registerLot(LOT_SPECIES, LOT_COUPE, LOT_GRADE, LOT_QTY, "")
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("reverts when qty is 0", async function () {
      await expect(
        contract.connect(auctionHouse).registerLot(LOT_SPECIES, LOT_COUPE, LOT_GRADE, 0n, "")
      ).to.be.revertedWith("Qty must be > 0");
    });

    it("getLotCount() increments correctly", async function () {
      const countBefore = await contract.getLotCount();
      await contract.connect(auctionHouse).registerLot("Pine", "KA-2024-002", "Grade B", 500n, "");
      expect(await contract.getLotCount()).to.equal(countBefore + 1n);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. purchaseWood()
  // ───────────────────────────────────────────────────────────────────────────

  describe("purchaseWood()", function () {
    // Lot #1 has 2000 cft
    const BUY_QTY = 100n;

    it("succeeds when FACTORY_ROLE wallet buys <= remainingQty", async function () {
      const tx = await contract.connect(factory).purchaseWood(1n, BUY_QTY);
      await expect(tx)
        .to.emit(contract, "WoodPurchased")
        .withArgs(1n, 1n, factory.address, BUY_QTY, (v) => typeof v === "bigint");
    });

    it("creates child batch with correct parentLotId", async function () {
      const batch = await contract.getBatch(1);
      expect(batch.id).to.equal(1n);
      expect(batch.parentLotId).to.equal(1n);
      expect(batch.qty).to.equal(BUY_QTY);
      expect(batch.remainingQty).to.equal(BUY_QTY);
      expect(batch.owner).to.equal(factory.address);
    });

    it("decrements lot remainingQty correctly", async function () {
      const lot = await contract.getLot(1);
      expect(lot.remainingQty).to.equal(LOT_QTY - BUY_QTY);
    });

    it("reverts when qty > remainingQty (conservation check)", async function () {
      const lot = await contract.getLot(1);
      const tooMuch = lot.remainingQty + 1n;
      await expect(
        contract.connect(factory).purchaseWood(1n, tooMuch)
      ).to.be.revertedWith("Insufficient lot quantity");
    });

    it("reverts when called by non-FACTORY_ROLE wallet", async function () {
      await expect(
        contract.connect(unauthorized).purchaseWood(1n, 10n)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("reverts when qty is 0", async function () {
      await expect(
        contract.connect(factory).purchaseWood(1n, 0n)
      ).to.be.revertedWith("Qty must be > 0");
    });

    it("getBatchCount() increments correctly", async function () {
      const countBefore = await contract.getBatchCount();
      await contract.connect(factory).purchaseWood(1n, 50n);
      expect(await contract.getBatchCount()).to.equal(countBefore + 1n);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. createFurniture()
  // ───────────────────────────────────────────────────────────────────────────

  describe("createFurniture()", function () {
    // Batch #1 has 100 cft remaining
    const USE_QTY = 40n;
    const FTYPE   = "Bed";
    const FIPFS   = "QmFurnitureCID456";

    it("succeeds when FACTORY_ROLE wallet uses <= batch.remainingQty", async function () {
      const tx = await contract
        .connect(factory)
        .createFurniture(1n, FTYPE, USE_QTY, FIPFS);

      await expect(tx)
        .to.emit(contract, "FurnitureCreated")
        .withArgs(1n, 1n, factory.address, FTYPE, USE_QTY, (v) => typeof v === "bigint");
    });

    it("stores correct sourceBatchId on furniture", async function () {
      const furniture = await contract.getFurniture(1);
      expect(furniture.id).to.equal(1n);
      expect(furniture.sourceBatchId).to.equal(1n);
      expect(furniture.furnitureType).to.equal(FTYPE);
      expect(furniture.qtyUsed).to.equal(USE_QTY);
      expect(furniture.manufacturer).to.equal(factory.address);
      expect(furniture.ipfsHash).to.equal(FIPFS);
    });

    it("decrements batch remainingQty correctly", async function () {
      const batch = await contract.getBatch(1);
      expect(batch.remainingQty).to.equal(100n - USE_QTY);
    });

    it("reverts when qty > remainingQty (conservation check)", async function () {
      const batch = await contract.getBatch(1);
      const tooMuch = batch.remainingQty + 1n;
      await expect(
        contract.connect(factory).createFurniture(1n, "Table", tooMuch, "")
      ).to.be.revertedWith("Insufficient batch quantity");
    });

    it("reverts when caller does not own the batch", async function () {
      // factory2 does not own batch #1 (factory does)
      await expect(
        contract.connect(factory2).createFurniture(1n, "Chair", 5n, "")
      ).to.be.revertedWith("Not batch owner");
    });

    it("reverts when qty is 0", async function () {
      await expect(
        contract.connect(factory).createFurniture(1n, "Table", 0n, "")
      ).to.be.revertedWith("Qty must be > 0");
    });

    it("getFurnitureCount() increments correctly", async function () {
      const countBefore = await contract.getFurnitureCount();
      await contract.connect(factory).createFurniture(1n, "Chair", 5n, "");
      expect(await contract.getFurnitureCount()).to.equal(countBefore + 1n);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Full end-to-end provenance chain
  // ───────────────────────────────────────────────────────────────────────────

  describe("Full provenance chain: lot → purchase → furniture", function () {
    let lotId, batchId, furnitureId;

    it("registers a fresh lot", async function () {
      const lotCountBefore = await contract.getLotCount();
      await contract
        .connect(auctionHouse)
        .registerLot("Rosewood", "KA-2024-099", "Grade S", 500n, "QmLotCID");
      lotId = lotCountBefore + 1n;

      const lot = await contract.getLot(lotId);
      expect(lot.species).to.equal("Rosewood");
      expect(lot.remainingQty).to.equal(500n);
    });

    it("factory purchases wood, creating a batch linked to the lot", async function () {
      const batchCountBefore = await contract.getBatchCount();
      await contract.connect(factory).purchaseWood(lotId, 200n);
      batchId = batchCountBefore + 1n;

      const batch = await contract.getBatch(batchId);
      expect(batch.parentLotId).to.equal(lotId);
      expect(batch.qty).to.equal(200n);
      expect(batch.remainingQty).to.equal(200n);

      // Lot qty decremented
      const lot = await contract.getLot(lotId);
      expect(lot.remainingQty).to.equal(300n);
    });

    it("factory creates furniture linked to the batch", async function () {
      const furnitureCountBefore = await contract.getFurnitureCount();
      await contract.connect(factory).createFurniture(batchId, "Table", 80n, "QmFurnCID");
      furnitureId = furnitureCountBefore + 1n;

      const furniture = await contract.getFurniture(furnitureId);
      expect(furniture.sourceBatchId).to.equal(batchId);
      expect(furniture.qtyUsed).to.equal(80n);

      // Batch qty decremented
      const batch = await contract.getBatch(batchId);
      expect(batch.remainingQty).to.equal(120n);
    });

    it("verifies full provenance chain: furniture → batch → lot", async function () {
      const furniture = await contract.getFurniture(furnitureId);
      const batch     = await contract.getBatch(furniture.sourceBatchId);
      const lot       = await contract.getLot(batch.parentLotId);

      // Chain integrity
      expect(furniture.sourceBatchId).to.equal(batch.id);
      expect(batch.parentLotId).to.equal(lot.id);

      // Data integrity across the chain
      expect(lot.species).to.equal("Rosewood");
      expect(lot.grade).to.equal("Grade S");
      expect(batch.qty).to.equal(200n);
      expect(furniture.furnitureType).to.equal("Table");
      expect(furniture.qtyUsed).to.equal(80n);

      // Mass-balance check: lot.remainingQty = initial - purchased
      expect(lot.initialQty - lot.remainingQty).to.equal(batch.qty);

      // Mass-balance check: batch.remainingQty = qty - used
      expect(batch.qty - batch.remainingQty).to.equal(furniture.qtyUsed);
    });
  });
});
