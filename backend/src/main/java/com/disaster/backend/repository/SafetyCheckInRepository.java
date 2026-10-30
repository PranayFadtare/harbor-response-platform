package com.disaster.backend.repository;

import java.util.List;
import java.util.Optional;

import com.disaster.backend.model.SafetyCheckIn;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SafetyCheckInRepository extends JpaRepository<SafetyCheckIn, Long> {
    Optional<SafetyCheckIn> findByUserEmailIgnoreCase(String userEmail);
    boolean existsByUserEmailIgnoreCase(String userEmail);
    List<SafetyCheckIn> findAllByOrderByMarkedAtDesc();
}
