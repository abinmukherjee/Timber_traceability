package com.timber.service;

import com.timber.config.RoleConstants;
import com.timber.entity.RoleEntity;
import com.timber.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;

    /**
     * Records a RoleGranted event — upserts with active=true.
     * If a matching wallet+roleName record exists (possibly inactive), re-activates it.
     */
    public RoleEntity grantRole(String wallet, String roleName, String roleBytes,
                                 String grantedBy, String txHash) {
        String normalizedWallet = wallet.toLowerCase();
        String normalizedRole   = roleName.toUpperCase();

        // Look for an existing record (could be previously revoked)
        Optional<RoleEntity> existing =
            roleRepository.findByWalletIgnoreCaseAndRoleNameAndActiveTrue(normalizedWallet, normalizedRole);

        if (existing.isPresent()) {
            log.warn("Role {} already active for {} — skipping duplicate grant", normalizedRole, normalizedWallet);
            return existing.get();
        }

        RoleEntity entity = RoleEntity.builder()
                .wallet(normalizedWallet)
                .roleName(normalizedRole)
                .roleBytes(roleBytes)
                .grantedBy(grantedBy != null ? grantedBy.toLowerCase() : null)
                .active(true)
                .txHash(txHash)
                .createdAt(Instant.now())
                .build();

        RoleEntity saved = roleRepository.save(entity);
        log.info("Role granted: wallet={} role={} by={}", normalizedWallet, normalizedRole, grantedBy);
        return saved;
    }

    /**
     * Records a RoleRevoked event — sets active=false for the matching wallet+role.
     */
    public void revokeRole(String wallet, String roleName, String txHash) {
        String normalizedWallet = wallet.toLowerCase();
        String normalizedRole   = roleName.toUpperCase();

        Optional<RoleEntity> existing =
            roleRepository.findByWalletIgnoreCaseAndRoleNameAndActiveTrue(normalizedWallet, normalizedRole);

        if (existing.isEmpty()) {
            log.warn("No active role {} found for {} to revoke", normalizedRole, normalizedWallet);
            return;
        }

        RoleEntity entity = existing.get();
        entity.setActive(false);
        entity.setTxHash(txHash);
        roleRepository.save(entity);
        log.info("Role revoked: wallet={} role={}", normalizedWallet, normalizedRole);
    }

    public List<RoleEntity> findAllActive() {
        return roleRepository.findByActiveTrue();
    }

    public List<RoleEntity> findAll() {
        return roleRepository.findAll();
    }

    /**
     * Prepares the role hash for the prepare-grant / prepare-revoke admin endpoints.
     * Returns the bytes32 hash for the given role name string.
     */
    public String getRoleHash(String roleName) {
        return RoleConstants.toHash(roleName);
    }
}
