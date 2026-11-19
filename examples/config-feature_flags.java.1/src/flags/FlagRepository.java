package com.acme.iam.flags;

import java.util.List;

public interface FlagRepository {
    List<FlagDefinition> loadAll();
}
