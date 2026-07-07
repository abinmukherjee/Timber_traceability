package com.timber.repository;

import com.timber.entity.BatchEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BatchRepository extends JpaRepository<BatchEntity, Long> {
    List<BatchEntity> findByFactory(String factory);
    List<BatchEntity> findByParentLotId(Long parentLotId);
}
