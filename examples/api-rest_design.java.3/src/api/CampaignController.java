package com.acme.ads.api;

import com.acme.ads.domain.Campaign;
import com.acme.ads.domain.CampaignRepository;
import com.acme.ads.domain.CampaignStatus;
import com.acme.ads.domain.Creative;
import com.acme.ads.domain.CreativeRepository;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/v2/campaigns")
public class CampaignController {

    private static final int MAX_PAGE_SIZE = 100;

    private final CampaignRepository campaigns;
    private final CreativeRepository creatives;

    public CampaignController(CampaignRepository campaigns, CreativeRepository creatives) {
        this.campaigns = campaigns;
        this.creatives = creatives;
    }

    public record CampaignDto(long id, String name, CampaignStatus status, long dailyBudgetMicros) {
        static CampaignDto from(Campaign c) {
            return new CampaignDto(c.getId(), c.getName(), c.getStatus(), c.getDailyBudgetMicros());
        }
    }

    public record CreativeDto(long id, long campaignId, String headline, String landingUrl) {
        static CreativeDto from(Creative c) {
            return new CreativeDto(c.getId(), c.getCampaignId(), c.getHeadline(), c.getLandingUrl());
        }
    }

    public record NewCreative(String headline, String landingUrl) {}

    public record CampaignPage(List<CampaignDto> items, int page, int size, long total) {}

    @GetMapping
    public CampaignPage list(
            @RequestParam(required = false) CampaignStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        int bounded = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        var result = campaigns.search(status, Math.max(page, 0), bounded);
        List<CampaignDto> items = result.rows().stream().map(CampaignDto::from).toList();
        return new CampaignPage(items, Math.max(page, 0), bounded, result.total());
    }

    @DeleteMapping("/{campaignId}")
    public ResponseEntity<Void> archive(@PathVariable long campaignId) {
        Campaign campaign = requireCampaign(campaignId);
        if (campaign.getStatus() != CampaignStatus.ARCHIVED) {
            campaign.setStatus(CampaignStatus.ARCHIVED);
            campaigns.save(campaign);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{campaignId}/creatives")
    public ResponseEntity<CreativeDto> addCreative(
            @PathVariable long campaignId, @RequestBody NewCreative body) {
        requireCampaign(campaignId);
        Creative saved = creatives.save(new Creative(campaignId, body.headline(), body.landingUrl()));
        URI location = UriComponentsBuilder.fromPath("/api/v2/campaigns/{cid}/creatives/{id}")
                .buildAndExpand(campaignId, saved.getId())
                .toUri();
        return ResponseEntity.created(location).body(CreativeDto.from(saved));
    }

    @GetMapping("/{campaignId}/creatives")
    public List<CreativeDto> listCreatives(@PathVariable long campaignId) {
        requireCampaign(campaignId);
        return creatives.findByCampaignId(campaignId).stream().map(CreativeDto::from).toList();
    }

    @GetMapping("/{campaignId}/creatives/{creativeId}")
    public CreativeDto getCreative(@PathVariable long campaignId, @PathVariable long creativeId) {
        requireCampaign(campaignId);
        Creative creative = creatives.findById(creativeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "creative not found"));
        return CreativeDto.from(creative);
    }

    @DeleteMapping("/{campaignId}/creatives/{creativeId}")
    public ResponseEntity<Void> deleteCreative(@PathVariable long campaignId, @PathVariable long creativeId) {
        requireCampaign(campaignId);
        creatives.deleteByIdAndCampaignId(creativeId, campaignId);
        return ResponseEntity.noContent().build();
    }

    private Campaign requireCampaign(long id) {
        return campaigns.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "campaign not found"));
    }
}
