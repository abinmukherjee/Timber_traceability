package com.timber.repository;

import com.timber.entity.LotEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LotRepository extends JpaRepository<LotEntity, Long> {
}
