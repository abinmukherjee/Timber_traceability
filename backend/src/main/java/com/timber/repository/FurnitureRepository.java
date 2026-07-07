package com.timber.repository;

import com.timber.entity.FurnitureEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FurnitureRepository extends JpaRepository<FurnitureEntity, Long> {
    List<FurnitureEntity> findBySourceBatchId(Long sourceBatchId);
    List<FurnitureEntity> findByManufacturer(String manufacturer);
}
