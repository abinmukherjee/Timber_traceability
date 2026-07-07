package com.timber.config;

/**
 * Precomputed keccak256 hashes of role names — mirrors the Solidity constants
 * in TimberSupplyChain.sol.
 *
 * These values are deterministic and must match:
 *   bytes32 public constant AUCTION_HOUSE_ROLE = keccak256("AUCTION_HOUSE_ROLE");
 *   bytes32 public constant FACTORY_ROLE       = keccak256("FACTORY_ROLE");
 *
 * Computed via: Web3j's Hash.sha3String() or any keccak256 implementation.
 * DEFAULT_ADMIN_ROLE in OpenZeppelin is bytes32(0) = 0x00...00
 */
public final class RoleConstants {

    private RoleConstants() {}

    /**
     * keccak256("AUCTION_HOUSE_ROLE")
     * Matches TimberSupplyChain.sol AUCTION_HOUSE_ROLE constant.
     */
    public static final String AUCTION_HOUSE_ROLE_HASH =
        "0x89b57a644ed9fce05f6c753cf42a08c2333c48e5a3d803e17cee19087358722b";

    /**
     * keccak256("FACTORY_ROLE")
     * Matches TimberSupplyChain.sol FACTORY_ROLE constant.
     */
    public static final String FACTORY_ROLE_HASH =
        "0xdfbefbf47cfe66b701d8cfdbce1de81c821590819cb07e71cb01b6602fb0ee27";

    /**
     * DEFAULT_ADMIN_ROLE from OpenZeppelin AccessControl = bytes32(0)
     */
    public static final String DEFAULT_ADMIN_ROLE_HASH =
        "0x0000000000000000000000000000000000000000000000000000000000000000";

    public static final String ROLE_AUCTION_HOUSE = "AUCTION_HOUSE";
    public static final String ROLE_FACTORY       = "FACTORY";
    public static final String ROLE_ADMIN         = "ADMIN";

    /**
     * Resolve a bytes32 role hash to its human-readable name.
     */
    public static String resolve(String roleHash) {
        if (roleHash == null) return "UNKNOWN";
        String normalized = roleHash.toLowerCase();
        return switch (normalized) {
            case "0x89b57a644ed9fce05f6c753cf42a08c2333c48e5a3d803e17cee19087358722b" -> ROLE_AUCTION_HOUSE;
            case "0xdfbefbf47cfe66b701d8cfdbce1de81c821590819cb07e71cb01b6602fb0ee27" -> ROLE_FACTORY;
            case "0x0000000000000000000000000000000000000000000000000000000000000000" -> ROLE_ADMIN;
            default -> roleHash;
        };
    }

    /**
     * Resolve a human-readable role name to its bytes32 hash.
     */
    public static String toHash(String roleName) {
        if (roleName == null) return null;
        return switch (roleName.toUpperCase()) {
            case "AUCTION_HOUSE" -> AUCTION_HOUSE_ROLE_HASH;
            case "FACTORY"       -> FACTORY_ROLE_HASH;
            case "ADMIN"         -> DEFAULT_ADMIN_ROLE_HASH;
            default              -> null;
        };
    }
}
