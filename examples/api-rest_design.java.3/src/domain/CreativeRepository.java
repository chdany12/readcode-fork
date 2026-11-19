package com.acme.ads.domain;

import java.util.List;
import java.util.Optional;

public interface CreativeRepository {

    Optional<Creative> findById(long id);

    List<Creative> findByCampaignId(long campaignId);

    Creative save(Creative creative);

    void deleteByIdAndCampaignId(long id, long campaignId);
}
