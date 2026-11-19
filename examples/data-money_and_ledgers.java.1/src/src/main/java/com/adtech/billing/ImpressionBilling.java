package com.adtech.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import javax.sql.DataSource;

public class ImpressionBilling {

    private static final BigDecimal IMPRESSIONS_PER_MILLE = BigDecimal.valueOf(1000);

    public record Campaign(String id, BigDecimal dailyBudget, BigDecimal cpm) {}

    private final DataSource dataSource;

    public ImpressionBilling(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean charge(String campaignId, String impressionId, LocalDate day) throws SQLException {
        Campaign campaign = loadCampaign(campaignId);
        BigDecimal cost = costOf(campaign);

        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try {
                if (!claimImpression(conn, impressionId, campaignId)) {
                    conn.rollback();
                    return false;
                }
                if (!bumpSpend(conn, campaign, day, cost)) {
                    conn.rollback();
                    return false;
                }
                conn.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                conn.rollback();
                throw e;
            }
        }
    }

    BigDecimal costOf(Campaign campaign) {
        return campaign.cpm().divide(IMPRESSIONS_PER_MILLE, RoundingMode.HALF_EVEN);
    }

    private Campaign loadCampaign(String campaignId) throws SQLException {
        String sql = "SELECT id, daily_budget, cpm FROM campaigns WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, campaignId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    throw new IllegalArgumentException("unknown campaign " + campaignId);
                }
                return new Campaign(rs.getString("id"), rs.getBigDecimal("daily_budget"), rs.getBigDecimal("cpm"));
            }
        }
    }

    private boolean claimImpression(Connection conn, String impressionId, String campaignId) throws SQLException {
        String sql = "INSERT INTO charged_impressions (impression_id, campaign_id) VALUES (?, ?) "
                + "ON CONFLICT (impression_id) DO NOTHING";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, impressionId);
            ps.setString(2, campaignId);
            return ps.executeUpdate() == 1;
        }
    }

    private boolean bumpSpend(Connection conn, Campaign campaign, LocalDate day, BigDecimal cost) throws SQLException {
        String ensure = "INSERT INTO campaign_spend (campaign_id, spend_date) VALUES (?, ?) "
                + "ON CONFLICT DO NOTHING";
        try (PreparedStatement ps = conn.prepareStatement(ensure)) {
            ps.setString(1, campaign.id());
            ps.setObject(2, day);
            ps.executeUpdate();
        }
        String bump = "UPDATE campaign_spend SET spent = spent + ? "
                + "WHERE campaign_id = ? AND spend_date = ? AND spent + ? <= ?";
        try (PreparedStatement ps = conn.prepareStatement(bump)) {
            ps.setBigDecimal(1, cost);
            ps.setString(2, campaign.id());
            ps.setObject(3, day);
            ps.setBigDecimal(4, cost);
            ps.setBigDecimal(5, campaign.dailyBudget());
            return ps.executeUpdate() == 1;
        }
    }
}
