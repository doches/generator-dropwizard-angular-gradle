package <%= package %>;

import io.dropwizard.Application;
import io.dropwizard.bundles.assets.ConfiguredAssetsBundle;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import <%= package %>.backend.DatabaseBackend;

/**
 * Main entry point to the <%= name %> API server.
 */
public final class <%= className %>Application extends Application<<%= className %>Configuration> {

    public static void main(final String[] args) throws Exception {
        new <%= className %>Application().run(args);
    }

    @Override
    public void initialize(Bootstrap<<%= className %>Configuration> bootstrap) {
        bootstrap.addBundle(new ConfiguredAssetsBundle("/assets/", "/", "index.html"));
    }

    @Override
    public void run(final <%= className %>Configuration configuration, final Environment environment) {
        //DatabaseBackend databaseBackend = configuration.getDatabaseBackend(environment);
    }
}
