package com.disaster.backend.model;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "emergency_requests")
public class EmergencyRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String phone;

    @Column(length = 1000)
    private String details;
    private String location;
    private Double latitude;
    private Double longitude;
    private String status;
    private String requesterEmail;
    private LocalDateTime createdAt;

    @Column(length = 500)
    private String needTags;

    @Column(length = 10)
    private String priority;

    public EmergencyRequest() {
    }

    @PrePersist
    void setDefaultsBeforePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null || status.isBlank()) {
            status = "OPEN";
        }
        if (priority == null || priority.isBlank()) {
            computePriority();
        }
    }

    public void computePriority() {
        if (needTags == null || needTags.isBlank()) {
            priority = "P4";
            return;
        }
        String tags = needTags.toLowerCase();
        if (tags.contains("trapped") || tags.contains("rescue")) {
            priority = "P1";
        } else if (tags.contains("medical")) {
            priority = tags.contains("infant") || tags.contains("elderly") ? "P1" : "P2";
        } else if (tags.contains("infant") || tags.contains("elderly")) {
            priority = "P2";
        } else if (tags.contains("shelter")) {
            priority = "P3";
        } else if (tags.contains("food") || tags.contains("water")) {
            priority = "P3";
        } else if (tags.contains("power") || tags.contains("utilities")) {
            priority = "P4";
        } else {
            priority = "P4";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRequesterEmail() {
        return requesterEmail;
    }

    public void setRequesterEmail(String requesterEmail) {
        this.requesterEmail = requesterEmail;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getNeedTags() {
        return needTags;
    }

    public void setNeedTags(String needTags) {
        this.needTags = needTags;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }
}
