// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TimberSupplyChain
 * @notice Blockchain-based provenance tracking for teakwood from auction lots
 *         through factory purchase to finished furniture.
 *
 * @dev Three on-chain entities: Lot, Batch, Furniture.
 *      Mass-balance invariant:
 *        - Lot.remainingQty   decreases by Batch.qty       on every purchaseWood()
 *        - Batch.remainingQty decreases by Furniture.qtyUsed on every createFurniture()
 *      All decrements are guarded by require() checks BEFORE state mutation.
 *
 *      Roles:
 *        DEFAULT_ADMIN_ROLE   — deployer; can grant/revoke other roles
 *        AUCTION_HOUSE_ROLE   — can call registerLot()
 *        FACTORY_ROLE         — can call purchaseWood() and createFurniture()
 */
contract TimberSupplyChain is AccessControl {
    // ─────────────────────────────────────────────────────────────────────────
    // Role constants
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant AUCTION_HOUSE_ROLE = keccak256("AUCTION_HOUSE_ROLE");
    bytes32 public constant FACTORY_ROLE       = keccak256("FACTORY_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Data structures
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice A wood lot registered by an auction house.
     *         Represents the full batch of raw timber entering the supply chain.
     */
    struct Lot {
        uint256 id;
        string  species;         // e.g. "Teak"
        string  originCoupeId;   // Forest/coupe identifier, e.g. "KA-2024-001"
        string  grade;           // e.g. "Grade A"
        uint256 initialQty;      // Total quantity at registration (cubic feet)
        uint256 remainingQty;    // Decremented on each purchaseWood()
        address owner;           // Auction house wallet
        uint256 createdAt;       // block.timestamp at registration
        string  ipfsHash;        // Optional IPFS CID of auction certificate
    }

    /**
     * @notice A wood batch created when a factory purchases from a lot.
     *         Uses UTXO-inspired model — provenance is in the object (parentLotId),
     *         not implied by an address balance.
     */
    struct Batch {
        uint256 id;
        uint256 parentLotId;   // Links to Lot — primary provenance link
        uint256 qty;           // Quantity purchased (cubic feet)
        uint256 remainingQty;  // Decremented on each createFurniture()
        address owner;         // Factory wallet
        uint256 createdAt;     // block.timestamp at purchase
    }

    /**
     * @notice A furniture piece manufactured from a batch.
     */
    struct Furniture {
        uint256 id;
        uint256 sourceBatchId;   // Links to Batch — provenance link
        string  furnitureType;   // e.g. "Bed", "Chair", "Table"
        uint256 qtyUsed;         // Cubic feet consumed from the batch
        address manufacturer;    // Factory wallet
        uint256 createdAt;       // block.timestamp at creation
        string  ipfsHash;        // IPFS CID of product certificate / image
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    mapping(uint256 => Lot)       public lots;
    mapping(uint256 => Batch)     public batches;
    mapping(uint256 => Furniture) public furnitures;

    uint256 private _lotCounter;
    uint256 private _batchCounter;
    uint256 private _furnitureCounter;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event LotRegistered(
        uint256 indexed lotId,
        address indexed auctionHouse,
        uint256         qty,
        uint256         timestamp
    );

    event WoodPurchased(
        uint256 indexed lotId,
        uint256 indexed batchId,
        address indexed factory,
        uint256         qty,
        uint256         timestamp
    );

    event FurnitureCreated(
        uint256 indexed furnitureId,
        uint256 indexed batchId,
        address indexed manufacturer,
        string          furnitureType,
        uint256         qty,
        uint256         timestamp
    );

    // NOTE: RoleGranted and RoleRevoked are inherited from OpenZeppelin AccessControl.
    //       They must NOT be redefined here.

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Grants DEFAULT_ADMIN_ROLE to the deployer.
     *         The admin can then grant AUCTION_HOUSE_ROLE and FACTORY_ROLE
     *         via OpenZeppelin's built-in grantRole() function.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Role assignment override
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Grants a role, enforcing that AUCTION_HOUSE_ROLE and FACTORY_ROLE
     *         are mutually exclusive per address. An auction house acting as its
     *         own factory (or vice versa) would let one entity fake an
     *         arm's-length transaction with itself, defeating provenance
     *         tracking. Must revoke the existing role before granting the other.
     * @dev Overrides AccessControl.grantRole. DEFAULT_ADMIN_ROLE is unaffected.
     */
    function grantRole(bytes32 role, address account)
        public
        virtual
        override
        onlyRole(getRoleAdmin(role))
    {
        if (role == AUCTION_HOUSE_ROLE || role == FACTORY_ROLE) {
            require(
                !hasRole(AUCTION_HOUSE_ROLE, account) && !hasRole(FACTORY_ROLE, account),
                "TimberSupplyChain: address already holds a supply-chain role"
            );
        }
        _grantRole(role, account);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State-changing functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new wood lot. Called by the auction house.
     * @param species       Species name, e.g. "Teak"
     * @param originCoupeId Forest/coupe identifier
     * @param grade         Quality grade, e.g. "Grade A"
     * @param qty           Initial quantity in cubic feet (must be > 0)
     * @param ipfsHash      IPFS CID of auction certificate (may be empty string)
     */
    function registerLot(
        string calldata species,
        string calldata originCoupeId,
        string calldata grade,
        uint256         qty,
        string calldata ipfsHash
    ) external onlyRole(AUCTION_HOUSE_ROLE) {
        require(qty > 0, "Qty must be > 0");

        _lotCounter++;
        uint256 lotId = _lotCounter;

        lots[lotId] = Lot({
            id:            lotId,
            species:       species,
            originCoupeId: originCoupeId,
            grade:         grade,
            initialQty:    qty,
            remainingQty:  qty,
            owner:         msg.sender,
            createdAt:     block.timestamp,
            ipfsHash:      ipfsHash
        });

        emit LotRegistered(lotId, msg.sender, qty, block.timestamp);
    }

    /**
     * @notice Purchase wood from a lot, creating a new Batch.
     *         Mass-balance: lots[lotId].remainingQty decremented by qty.
     * @param lotId  ID of the lot to purchase from
     * @param qty    Quantity to purchase in cubic feet (must be > 0 and <= remainingQty)
     */
    function purchaseWood(
        uint256 lotId,
        uint256 qty
    ) external onlyRole(FACTORY_ROLE) {
        require(qty > 0, "Qty must be > 0");
        // Conservation check BEFORE state mutation
        require(lots[lotId].remainingQty >= qty, "Insufficient lot quantity");

        // State mutation
        lots[lotId].remainingQty -= qty;

        _batchCounter++;
        uint256 batchId = _batchCounter;

        batches[batchId] = Batch({
            id:           batchId,
            parentLotId:  lotId,
            qty:          qty,
            remainingQty: qty,
            owner:        msg.sender,
            createdAt:    block.timestamp
        });

        emit WoodPurchased(lotId, batchId, msg.sender, qty, block.timestamp);
    }

    /**
     * @notice Create a furniture piece by consuming wood from a batch.
     *         Mass-balance: batches[batchId].remainingQty decremented by qty.
     * @param batchId       ID of the batch to consume from
     * @param furnitureType Type of furniture, e.g. "Bed"
     * @param qty           Quantity consumed in cubic feet (must be > 0 and <= remainingQty)
     * @param ipfsHash      IPFS CID of product certificate / image
     */
    function createFurniture(
        uint256         batchId,
        string calldata furnitureType,
        uint256         qty,
        string calldata ipfsHash
    ) external onlyRole(FACTORY_ROLE) {
        require(batches[batchId].owner == msg.sender, "Not batch owner");
        require(qty > 0, "Qty must be > 0");
        // Conservation check BEFORE state mutation
        require(batches[batchId].remainingQty >= qty, "Insufficient batch quantity");

        // State mutation
        batches[batchId].remainingQty -= qty;

        _furnitureCounter++;
        uint256 furnitureId = _furnitureCounter;

        furnitures[furnitureId] = Furniture({
            id:            furnitureId,
            sourceBatchId: batchId,
            furnitureType: furnitureType,
            qtyUsed:       qty,
            manufacturer:  msg.sender,
            createdAt:     block.timestamp,
            ipfsHash:      ipfsHash
        });

        emit FurnitureCreated(furnitureId, batchId, msg.sender, furnitureType, qty, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions (no access restrictions — public read)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the full Lot struct for the given ID
    function getLot(uint256 id) external view returns (Lot memory) {
        return lots[id];
    }

    /// @notice Returns the full Batch struct for the given ID
    function getBatch(uint256 id) external view returns (Batch memory) {
        return batches[id];
    }

    /// @notice Returns the full Furniture struct for the given ID
    function getFurniture(uint256 id) external view returns (Furniture memory) {
        return furnitures[id];
    }

    /// @notice Returns the total number of lots registered
    function getLotCount() external view returns (uint256) {
        return _lotCounter;
    }

    /// @notice Returns the total number of batches created
    function getBatchCount() external view returns (uint256) {
        return _batchCounter;
    }

    /// @notice Returns the total number of furniture pieces created
    function getFurnitureCount() external view returns (uint256) {
        return _furnitureCounter;
    }
}
