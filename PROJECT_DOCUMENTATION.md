# TimberTrace — Complete Project Documentation

> Blockchain-based timber supply-chain traceability. This document explains the objective of the project, how every component works, what each function does, the end-to-end workflow, and the gas cost of every on-chain operation. Read it top to bottom and you will understand the entire system.

---

## 1. Objective

TimberTrace tracks **teakwood provenance** on the **Ethereum Sepolia testnet**, following a physical piece of wood through three stages:

1. **Auction House** registers a raw timber **Lot** (e.g. 2000 cubic feet of Grade-A Teak from forest coupe KA-2024-001).
2. **Factory** buys part of that lot, creating a **Batch** (a UTXO-style child that carries a link back to its parent lot).
3. **Factory** manufactures a **Furniture** piece from a batch, consuming some of the wood.

Every furniture piece carries a **QR code**. Scanning it resolves the entire chain — *Furniture → Batch → Lot → Forest Origin* — proving the wood was legally sourced and not laundered through fake transactions.

The core guarantee is a **mass-balance (conservation) invariant**: you can never manufacture or buy more wood than physically exists at the previous stage. This is enforced on-chain with `require()` checks *before* any state change.

---

## 2. Architecture & Data Flow

```
 MetaMask (browser wallet)
    │  signs & sends transactions
    ▼
 Frontend (HTML + Vanilla JS) ────────► Pinata IPFS API   (certificate/image upload BEFORE the txn)
    │  reads data                                  │
    │                                              ▼  returns CID
    │                                    CID is passed as a txn argument
    ▼ reads
 Spring Boot REST API (:8080) ◄──────────┐
    │  read / write                       │ POST /api/internal/*  (mirror events)
    ▼                                     │
 PostgreSQL DB  ◄──── ethers.js Listener ─┘◄──── Sepolia Ethereum (emits events)
 (read mirror)                                        ▲
                                          TimberSupplyChain.sol (deployed contract = source of truth)
```

**Key principle:** the **blockchain is the single source of truth**. PostgreSQL is only a *read-optimised mirror* so the frontend can query fast without hitting the chain for every read. The listener keeps the mirror in sync by relaying mined events.

### Tech stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity ^0.8.20, OpenZeppelin Contracts v5 (`AccessControl`) |
| Dev / test | Hardhat, Chai, hardhat-gas-reporter, solidity-coverage |
| Wallet / signing | MetaMask |
| Chain interaction | ethers.js v6 |
| Backend | Spring Boot 3.x (Java 17), Lombok, JPA/Hibernate |
| Database | PostgreSQL |
| Off-chain storage | IPFS via Pinata |
| QR codes | Google ZXing |
| Frontend | Plain HTML + Vanilla JS |

---

## 3. The Smart Contract — `TimberSupplyChain.sol`

The heart of the system. Inherits OpenZeppelin `AccessControl` for role management.

### 3.1 Roles

| Role | Value | Powers |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `bytes32(0)` | Granted to deployer. Can grant/revoke all other roles. |
| `AUCTION_HOUSE_ROLE` | `keccak256("AUCTION_HOUSE_ROLE")` | Can call `registerLot()`. |
| `FACTORY_ROLE` | `keccak256("FACTORY_ROLE")` | Can call `purchaseWood()` and `createFurniture()`. |

Roles `AUCTION_HOUSE_ROLE` and `FACTORY_ROLE` are **mutually exclusive** per address — one wallet cannot be both, which prevents an entity from faking an arm's-length sale to itself.

### 3.2 Data structures (on-chain storage)

- **`Lot`** — raw timber entering the chain: `id, species, originCoupeId, grade, initialQty, remainingQty, owner, createdAt, ipfsHash`. `remainingQty` decreases on each purchase.
- **`Batch`** — wood a factory bought from a lot: `id, parentLotId, qty, remainingQty, owner, createdAt`. `parentLotId` is the provenance link. `remainingQty` decreases on each furniture creation.
- **`Furniture`** — a finished product: `id, sourceBatchId, furnitureType, qtyUsed, manufacturer, createdAt, ipfsHash`. `sourceBatchId` is the provenance link.

Storage: three `mapping(uint256 => Struct)` tables (`lots`, `batches`, `furnitures`) plus three private counters that also act as auto-increment ID generators.

### 3.3 Functions — objective & gas cost

> **Gas note:** Values below are **engineering estimates** for the Solidity optimizer at `runs: 200`, assuming short strings. Actual figures are produced by `hardhat-gas-reporter` (enabled in `hardhat.config.js`) when you run `npx hardhat test`. Writing a brand-new storage slot costs ~20,000 gas; modifying an existing one ~5,000; each indexed event topic and string byte adds cost — which is why the string-heavy functions are the most expensive.

| Function | Access | Objective | Approx. gas |
|---|---|---|---|
| `constructor()` | — | Grants `DEFAULT_ADMIN_ROLE` to deployer. Runs once at deploy. | ~1,150,000 (full deployment) |
| `grantRole(role, account)` **(overridden)** | admin of role | Grants a role, but first enforces that supply-chain roles are mutually exclusive (reverts if the address already holds `AUCTION_HOUSE_ROLE` or `FACTORY_ROLE`). Emits `RoleGranted`. | ~50,000–55,000 |
| `revokeRole(role, account)` | admin of role | Inherited from OpenZeppelin. Removes a role; emits `RoleRevoked`. Gets a partial gas refund for clearing a slot. | ~30,000 |
| `registerLot(species, originCoupeId, grade, qty, ipfsHash)` | `AUCTION_HOUSE_ROLE` | Creates a new `Lot`. Requires `qty > 0`. Increments `_lotCounter`, stores the struct, emits `LotRegistered`. **Most expensive write** — stores 4 strings. | ~230,000–300,000 |
| `purchaseWood(lotId, qty)` | `FACTORY_ROLE` | Buys `qty` from a lot. Requires `qty > 0` and `lot.remainingQty >= qty` **before** mutating. Decrements the lot, creates a child `Batch` (no strings), emits `WoodPurchased`. | ~150,000–185,000 |
| `createFurniture(batchId, furnitureType, qty, ipfsHash)` | `FACTORY_ROLE` | Manufactures furniture from a batch. Requires caller **owns the batch**, `qty > 0`, and `batch.remainingQty >= qty`. Decrements the batch, stores a `Furniture` (2 strings), emits `FurnitureCreated`. | ~200,000–260,000 |
| `getLot(id)` / `getBatch(id)` / `getFurniture(id)` | public view | Returns the full struct for an ID. | 0 (off-chain `eth_call`) |
| `getLotCount()` / `getBatchCount()` / `getFurnitureCount()` | public view | Returns the respective counter (total records). | 0 (off-chain `eth_call`) |
| `lots(id)` / `batches(id)` / `furnitures(id)` | public mapping getters | Auto-generated getters for direct mapping reads. | 0 (off-chain `eth_call`) |

> View functions cost **0 gas** when called externally via `eth_call` (the frontend/listener never pay for reads). They only cost gas if invoked from within another on-chain transaction.

### 3.4 Events (the sync backbone)

| Event | Emitted by | Indexed fields |
|---|---|---|
| `LotRegistered(lotId, auctionHouse, qty, timestamp)` | `registerLot` | lotId, auctionHouse |
| `WoodPurchased(lotId, batchId, factory, qty, timestamp)` | `purchaseWood` | lotId, batchId, factory |
| `FurnitureCreated(furnitureId, batchId, manufacturer, furnitureType, qty, timestamp)` | `createFurniture` | furnitureId, batchId, manufacturer |
| `RoleGranted` / `RoleRevoked` | OpenZeppelin `AccessControl` | role, account, sender |

These events are what the off-chain listener subscribes to. **Note:** events carry only IDs/amounts/addresses — strings like `species` and `grade` live in the struct storage, *not* the event, which is why the DB mirror for a lot initially has null species (see §5.2).

---

## 4. Deployment Script — `contracts/scripts/deploy.js`

**Objective:** deploy the contract and wire the rest of the system to it.

Flow of `main()`:
1. Prints network, deployer address, and balance.
2. Deploys `TimberSupplyChain` and waits for confirmation.
3. Reads the compiled artifact to get the ABI.
4. Builds a config object `{ address, abi, network, deployedAt, deployer }`.
5. Writes `contract-config.json` to `contracts/` **and** the project root (used by the listener).
6. Writes `frontend/js/contract-config.js` (a JS `const CONTRACT_CONFIG = {...}`) so the frontend has the address + ABI.
7. Prints next steps (paste the address into `listener/.env` and `application.properties`).

This single script is the glue that gives every other component the deployed address and ABI.

---

## 5. Event Listener — `listener/index.js`

An ethers.js v6 **WebSocket** observer. It sends **no transactions** — it only listens and relays.

### 5.1 Setup
- Loads `SEPOLIA_WS_URL`, `CONTRACT_ADDRESS`, `BACKEND_URL` from `.env`; exits if the first two are missing.
- Loads the ABI from `contract-config.json`.
- Builds a role-hash → name map (`AUCTION_HOUSE`, `FACTORY`, `ADMIN`) so `RoleGranted` events can be labelled.

### 5.2 Functions

| Function | Objective |
|---|---|
| `resolveRoleName(bytes32)` | Maps a keccak256 role hash to a human name; falls back to the raw hash. |
| `postToBackend(endpoint, payload, txHash)` | POSTs a payload to the backend with a 10s timeout. **Swallows errors** (logs, never re-throws) so a backend failure can't crash the listener. |
| `startListener()` | Opens the WebSocket, registers a handler for each of the 5 events, and wires WebSocket lifecycle (`open`, `close` → auto-reconnect after 5s, `error`) plus `SIGINT`/`SIGTERM` graceful shutdown. |

### 5.3 Event → endpoint mapping

| On-chain event | Listener POSTs to |
|---|---|
| `LotRegistered` | `POST /api/internal/lots` |
| `WoodPurchased` | `POST /api/internal/batches` |
| `FurnitureCreated` | `POST /api/internal/furnitures` |
| `RoleGranted` | `POST /api/internal/roles/grant` |
| `RoleRevoked` | `POST /api/internal/roles/revoke` |

Only **mined** events fire the handlers — there is no pending-transaction handling. On reconnect it removes old listeners to avoid duplicate handlers.

---

## 6. Backend — Spring Boot (`backend/`)

A read/write mirror layer. **It never holds a private key** and never sends blockchain transactions; it only serves data and prepares role hashes.

### 6.1 Controllers

**`PublicController`** (read-only, called by the frontend, CORS `*`):

| Endpoint | Objective |
|---|---|
| `GET /api/lots`, `/api/lots/{id}` | All lots / one lot. |
| `GET /api/batches`, `/api/batches/{id}`, `/api/batches?factory=0x…` | All batches / one / filtered by factory address. |
| `GET /api/furnitures/{id}` | One furniture piece. |
| `GET /api/furnitures/{id}/provenance` and `GET /api/verify/{id}` | Full provenance chain (the QR-scan endpoint). Returns 404 if the furniture is missing, 500 if a link is broken. |
| `GET /api/roles` | Active (or all) role assignments. |
| `GET /api/stats` | Dashboard counts: `{lots, batches, furnitures, roles}`. |
| `GET /api/qr/{id}` | Serves the QR PNG file from disk. |

**`InternalController`** (`/api/internal/*`, called **only** by the listener, no auth — meant for a private network):
- Parses each event payload, delegates to the matching service, returns `{status:"ok", …}`.
- All handlers are **idempotent** — re-sending the same event is safe (services skip duplicates by primary key).
- Endpoints: `/lots`, `/batches`, `/furnitures`, `/roles/grant`, `/roles/revoke`.

**`AdminController`** (`/api/admin/*`, called by the Admin UI):
- `POST /roles/prepare-grant` and `POST /roles/prepare-revoke` — validate input and return the **bytes32 role hash** the frontend needs to call `grantRole()`/`revokeRole()` via MetaMask. **No key, no transaction** — it just hands back the hash.
- `GET /roles/hashes` — returns all known role hashes for reference.

### 6.2 Services (business logic)

| Service | Key methods & objective |
|---|---|
| `LotService` | `saveLotFromEvent(...)` — idempotent insert of a lot from an event (species/grade are null because they're not in the event). Plus `findById`, `findAll`, `count`. |
| `BatchService` | `saveBatchFromEvent(...)` — idempotent insert of a batch. `findByFactory` (lower-cased), `findById`, `findAll`, `count`. |
| `FurnitureService` | `saveFurnitureFromEvent(...)` — idempotent insert; **triggers QR generation** and stores the URL. `getProvenanceChain(id)` — walks Furniture → Batch → Lot, throwing `IllegalArgumentException` (missing furniture → 404) or `IllegalStateException` (broken link → 500), returns a structured `{furniture, batch, lot}` map. |
| `RoleService` | `grantRole(...)` — upsert a role record active=true (skips if already active). `revokeRole(...)` — set active=false. `getRoleHash(name)` — delegates to `RoleConstants.toHash`. |
| `QRCodeService` | `generateQRCode(id)` — uses ZXing to write a 400×400 PNG encoding `{appBaseUrl}/verify.html?id={id}` to `./qr-codes/`. `getQRCodeUrl(id)` — returns the public API URL. |

### 6.3 Config & Entities

- **`RoleConstants`** — hard-coded keccak256 hashes matching the Solidity constants, with `resolve()` (hash→name) and `toHash()` (name→hash). These must never drift from the contract.
- **Entities** (`LotEntity`, `BatchEntity`, `FurnitureEntity`, `RoleEntity`) — JPA `@Entity` classes mirroring the on-chain structs. IDs (`lotId`, `batchId`, `furnitureId`) are the on-chain IDs used as primary keys, which is what makes inserts naturally idempotent. `RoleEntity` uses an auto-generated `id` plus an `active` flag. Wallet addresses are stored lower-cased (`length = 42`), tx hashes `length = 66`.
- **`application.properties`** — server port 8080, PostgreSQL datasource (`timber_db`), `ddl-auto=update` (Hibernate auto-creates tables), the deployed `contract.address`, Pinata JWT, QR output dir, and `app.base.url` used inside QR codes.

> ⚠️ The committed `application.properties` contains a real-looking DB password and Pinata token, and `contracts/.env` / `listener/.env` may hold RPC keys. Treat these as **secrets to rotate** before any public deployment.

---

## 7. Frontend (`frontend/`)

Plain HTML pages driven by shared JS. Each page connects MetaMask and talks to both the contract (writes) and the backend (reads).

### 7.1 Pages
- `index.html` — dashboard (stats + lists).
- `auction.html` — Auction House: upload certificate to Pinata → `registerLot()`.
- `factory.html` — Factory: Tab 1 `purchaseWood()`, Tab 2 upload image → `createFurniture()`.
- `admin.html` — role management: prepare-grant → `grantRole()`/`revokeRole()` via MetaMask.
- `verify.html` — QR-scan target; reads `?id=` and shows the full provenance timeline.

### 7.2 Shared JS

| File | Objective |
|---|---|
| `wallet.js` | `connectWallet()` (connect MetaMask, force Sepolia chain `0xaa36a7`), `getContract(signer)` (build an ethers Contract from `CONTRACT_CONFIG`), plus UI helpers and account/chain-change reload listeners. |
| `api.js` | Thin `fetch` wrappers for every backend endpoint, plus `uploadToPinata(file, jwt)` (**must run before** the chain txn — the returned CID becomes a contract argument), `ipfsUrl(cid)`, and formatting helpers. |
| `contract-config.js` | Auto-generated by `deploy.js`; holds the deployed address + ABI. |

---

## 8. End-to-End Workflow

1. **Admin** (`admin.html`) connects the deployer wallet → grants `AUCTION_HOUSE_ROLE` to Wallet A and `FACTORY_ROLE` to Wallet B. → `RoleGranted` events → listener → `roles` table updated.
2. **Auction House (Wallet A)** (`auction.html`) uploads the auction certificate to Pinata (gets a CID) → calls `registerLot("Teak", "KA-2024-001", "Grade A", 2000, CID)`. → `LotRegistered` → listener → `lots` table.
3. **Factory (Wallet B)** (`factory.html`, Tab 1) calls `purchaseWood(1, 100)` → lot's `remainingQty` drops to 1900, Batch #1 created. → `WoodPurchased` → `batches` table.
4. **Factory (Wallet B)** (`factory.html`, Tab 2) uploads a product image to Pinata → calls `createFurniture(1, "Bed", 40, CID)` → batch's `remainingQty` drops to 60, Furniture #1 created. → `FurnitureCreated` → `furnitures` table **and QR PNG generated**.
5. **Anyone** scans the QR → `verify.html?id=1` → `GET /api/verify/1` → backend returns Furniture → Batch → Lot → Forest Origin timeline.
6. **Unauthorized wallet** attempting `registerLot` → contract **reverts** (`onlyRole`) → nothing is written to the DB, because the listener only reacts to successfully mined events.

---

## 9. Critical Design Rules (Security & Integrity)

1. **Backend never holds a private key** — every state change is signed by MetaMask.
2. **IPFS upload always precedes the chain transaction** — the CID is a transaction argument, so the certificate is pinned before provenance is recorded.
3. **Every state-changing contract function has an `onlyRole()` modifier.**
4. **Conservation `require()` checks run before any state mutation** — you cannot over-draw a lot or a batch.
5. **The listener fires only on mined events** — no speculative/pending handling, so the DB never records a reverted action.
6. **The database is a read mirror; the chain is the source of truth.** DB inserts are idempotent (keyed by on-chain ID).
7. **Provenance is by object linkage** (`parentLotId`, `sourceBatchId`) — never inferred from an address balance, which is what makes the chain auditable and tamper-evident.
8. **Roles are mutually exclusive** — one address can't be both auction house and factory.

---

## 10. Gas Cost Summary

| Operation | Type | Approx. gas | Why |
|---|---|---|---|
| Contract deployment | one-time | ~1,150,000 | Deploys bytecode + AccessControl. |
| `grantRole` | write | ~50,000–55,000 | 2 role reads + 1 new slot + event. |
| `revokeRole` | write | ~30,000 | Clears a slot (partial refund) + event. |
| `registerLot` | write | ~230,000–300,000 | Stores 4 strings + numeric fields + event. **Highest.** |
| `purchaseWood` | write | ~150,000–185,000 | 1 slot update + new struct (no strings) + event. |
| `createFurniture` | write | ~200,000–260,000 | 1 slot update + struct with 2 strings + event. |
| Any `get*` / mapping getter | read (`eth_call`) | 0 | Off-chain reads are free. |

> To get exact numbers for your compiler/optimizer settings, run `cd contracts && npx hardhat test` — `hardhat-gas-reporter` (already enabled) prints a per-function gas table (and USD cost) at the end of the run. String length is the dominant variable in the three write functions.

---

## 11. How to Run (quick reference)

```bash
# 1. Contract
cd contracts && npm install
npx hardhat test                                   # runs suite + gas report
npx hardhat run scripts/deploy.js --network sepolia  # writes contract-config.json

# 2. Database:  CREATE DATABASE timber_db;  (Spring Boot auto-creates tables)

# 3. Backend
cd backend && mvn spring-boot:run                  # :8080

# 4. Listener
cd listener && npm install && npm start            # subscribes to Sepolia events

# 5. Frontend
cd frontend && python -m http.server 5500          # or Live Server / npx serve
```

*Test coverage:* `contracts/test/TimberSupplyChain.test.js` covers role setup, all three write functions (success + every revert path), counter increments, batch-ownership enforcement, and a full end-to-end provenance + mass-balance assertion.
