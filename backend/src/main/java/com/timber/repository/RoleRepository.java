package com.timber.repository;

import com.timber.entity.RoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<RoleEntity, Long> {
    List<RoleEntity> findByActiveTrue();
    Optional<RoleEntity> findByWalletIgnoreCaseAndRoleNameAndActiveTrue(String wallet, String roleName);
    List<RoleEntity> findByWalletIgnoreCase(String wallet);
}
