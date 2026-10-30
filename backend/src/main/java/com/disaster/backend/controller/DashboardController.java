package com.disaster.backend.controller;

import java.util.Map;

import com.disaster.backend.repository.DisasterRepository;
import com.disaster.backend.repository.EmergencyRequestRepository;
import com.disaster.backend.repository.SafetyCheckInRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DisasterRepository disasterRepository;
    private final EmergencyRequestRepository emergencyRequestRepository;
    private final SafetyCheckInRepository safetyCheckInRepository;

    public DashboardController(
            DisasterRepository disasterRepository,
            EmergencyRequestRepository emergencyRequestRepository,
            SafetyCheckInRepository safetyCheckInRepository) {
        this.disasterRepository = disasterRepository;
        this.emergencyRequestRepository = emergencyRequestRepository;
        this.safetyCheckInRepository = safetyCheckInRepository;
    }

    @GetMapping
    public Map<String, Long> getDashboardSummary() {
        return Map.of(
                "totalDisasters", disasterRepository.count(),
                "totalEmergencyRequests", emergencyRequestRepository.count(),
                "totalSafeCheckIns", safetyCheckInRepository.count());
    }
}
