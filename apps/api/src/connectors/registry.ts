import { type BaseConnector } from './base.connector.js';
import { InstagramConnector } from './instagram.connector.js';
import { LinkedInConnector } from './linkedin.connector.js';

/**
 * Connector registry — maps platform identifiers to their connector
 * implementations.  See TDD Section 6.4.
 *
 * Adding a new platform:
 *   1. Implement BaseConnector methods.
 *   2. Register here.
 *   3. Add platform to Channel.platform enum.
 *   Zero changes to services, routes, or frontend.
 */
export class ConnectorRegistry {
    private static connectors = new Map<string, BaseConnector>();

    static register(connector: BaseConnector): void {
        this.connectors.set(connector.platform, connector);
    }

    static getConnector(platform: string): BaseConnector {
        const connector = this.connectors.get(platform);
        if (!connector) {
            throw new Error(`No connector registered for platform: ${platform}`);
        }
        return connector;
    }
}

ConnectorRegistry.register(new InstagramConnector());
ConnectorRegistry.register(new LinkedInConnector());
