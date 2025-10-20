import { db as globalDb } from "@/db";

import { createGuildApi } from "./guild";
import { formatError } from "./helpers";
import { type DatabaseClient, type FlatDataStore } from "./types";
import { createUserApi } from "./users";

/**
 * Assemble the full flat API backed by an optional database connection.
 *
 * @param options Optional configuration, including a custom database client.
 * @returns Composite data access layer for guild and user state.
 */
export function createFlatApi(
  options: { db?: DatabaseClient } = {},
): FlatDataStore {
  const database = options.db ?? globalDb;

  /**
   * Build a flat API instance bound to a specific database connection.
   *
   * @param connection Database client used to execute queries.
   * @returns Composite data store for the connection.
   */
  const buildStore = (connection: DatabaseClient): FlatDataStore => {
    const guildApi = createGuildApi(connection);
    const userApi = createUserApi(connection);

    return {
      ...guildApi,
      ...userApi,
      /**
       * Execute operations within a database transaction using a nested store.
       *
       * @param fn Transaction callback receiving a transactional store.
       * @returns Value produced by the callback when the transaction succeeds.
       */
      async transaction<T>(
        fn: (store: FlatDataStore) => Promise<T>,
      ): Promise<T> {
        try {
          return await connection.transaction(async (tx) => {
            const nested = buildStore(tx as unknown as DatabaseClient);
            try {
              return await fn(nested);
            } catch (error) {
              throw formatError("Transaction callback failed", error);
            }
          });
        } catch (error) {
          throw formatError("Transaction failed", error);
        }
      },
    };
  };

  return buildStore(database);
}

const defaultFlatApi = createFlatApi();

export function getDbApi(): FlatDataStore {
  return defaultFlatApi;
}

