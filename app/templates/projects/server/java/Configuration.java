package <%= package %>;

import static com.google.common.base.Preconditions.checkNotNull;

import <%= package %>.backend.DatabaseBackend;
import <%= package %>.backend.DatabaseConfiguration;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.dropwizard.Configuration;
import io.dropwizard.bundles.assets.AssetsBundleConfiguration;
import io.dropwizard.bundles.assets.AssetsConfiguration;
import io.dropwizard.setup.Environment;

/**
 * Server configuration for the <%= name %> API server.
 */
public final class <%= className %>Configuration extends Configuration
        implements AssetsBundleConfiguration {

    private final AssetsConfiguration assets;
    private final DatabaseConfiguration databaseConfiguration;

    @JsonCreator
    public <%= className %>Configuration(
            @JsonProperty("assets") final AssetsConfiguration assets,
            @JsonProperty("database") final DatabaseConfiguration database) {
        checkNotNull(assets);
        checkNotNull(database);

        this.assets = assets;
        this.databaseConfiguration = database;
    }

    @Override
    public AssetsConfiguration getAssetsConfiguration() { return assets; }

    public DatabaseConfiguration getDatabaseConfiguration() { return databaseConfiguration; }

    public DatabaseBackend getDatabaseBackend(Environment environment) {
        return databaseConfiguration.createDBI(environment, "jdbi-backend").onDemand(DatabaseBackend.class);
    }
}
