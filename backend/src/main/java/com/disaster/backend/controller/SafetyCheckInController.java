package com.disaster.backend.controller;

import java.util.List;
import java.util.Map;

import com.disaster.backend.model.AppUser;
import com.disaster.backend.model.SafetyCheckIn;
import com.disaster.backend.repository.AppUserRepository;
import com.disaster.backend.repository.SafetyCheckInRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/safety-checkins")
public class SafetyCheckInController {

    private final SafetyCheckInRepository checkInRepository;
    private final AppUserRepository userRepository;

    public SafetyCheckInController(SafetyCheckInRepository checkInRepository, AppUserRepository userRepository) {
        this.checkInRepository = checkInRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<SafetyCheckIn> getAllCheckIns() {
        return checkInRepository.findAllByOrderByMarkedAtDesc();
    }

    @GetMapping("/count")
    public Map<String, Long> getCount() {
        return Map.of("count", checkInRepository.count());
    }

    @GetMapping("/me")
    public ResponseEntity<SafetyCheckIn> myCheckIn(@AuthenticationPrincipal UserDetails user) {
        return checkInRepository.findByUserEmailIgnoreCase(user.getUsername())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<SafetyCheckIn> markSafe(
            @RequestBody SafetyCheckIn request,
            @AuthenticationPrincipal UserDetails user) {
        String email = user.getUsername();

        AppUser appUser = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        SafetyCheckIn checkIn = checkInRepository.findByUserEmailIgnoreCase(email)
                .orElse(new SafetyCheckIn(appUser.getFullName(), request.getPhone(), request.getLocation(), email));

        checkIn.setFullName(appUser.getFullName());
        checkIn.setPhone(request.getPhone());
        checkIn.setLocation(request.getLocation());
        checkIn.setMarkedAt(java.time.LocalDateTime.now());

        return ResponseEntity.status(HttpStatus.CREATED).body(checkInRepository.save(checkIn));
    }
}
