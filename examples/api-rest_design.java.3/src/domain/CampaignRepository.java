package com.acme.ads.domain;

import java.util.List;
import java.util.Optional;

public interface CampaignRepository {

    record Result(List<Campaign> rows, long total) {}

    Optional<Campaign> findById(long id);

    Campaign save(Campaign campaign);

    Result search(CampaignStatus status, int page, int size);
}
