import { BaseRepository } from "./BaseRepository";
import { SWRCache } from "../cache/SWRCache";

export type HookState = {
  botId: string;
  webhookUrl: string;
  secretToken: string;
  failed: boolean;
  failureDetectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  // Timing fields for conflict resolution
  apiCallAt?: Date; // When we called Telegram API
  apiRespAt?: Date; // When we got response
  dbUpdateAt?: Date; // When we updated database
  lastWebhookUrl?: string; // What Telegram thinks the webhook is
};

export class HookStateRepository extends BaseRepository {
  async initialize() {
    await this.collection.createIndex({ botId: 1 }, { unique: true });
  }

  private getCurrentVersion = SWRCache.wrapFn(async (botId: string) => {
    const result = await this.collection.findOne(
      { botId },
      { projection: { version: 1 } },
    );

    return result?.version || null;
  }, this.logger);

  public async create({
    botId,
    webhookUrl,
    secretToken,
  }: Pick<HookState, "botId" | "webhookUrl" | "secretToken">) {
    await this.ready;

    const now = new Date();

    await this.collection.insertOne({
      botId,
      webhookUrl,
      secretToken,
      failed: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  public async getByBotId(botId: string): Promise<HookState | null> {
    await this.ready;

    return this.collection.findOne<HookState>({ botId });
  }

  public async update({
    botId,
    webhookUrl,
    secretToken,
  }: Omit<
    HookState,
    "failed" | "failureDetectedAt" | "createdAt" | "updatedAt" | "version"
  >): Promise<{ success: boolean }> {
    await this.ready;

    const now = new Date();
    const currentVersion = await this.getCurrentVersion(botId);

    if (currentVersion === null) {
      // No existing state, insert new one
      await this.collection.insertOne({
        botId,
        webhookUrl,
        secretToken,
        failed: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });

      this.getCurrentVersion.set(1, botId);

      return { success: true };
    }

    const result = await this.collection.updateOne(
      {
        botId,
        version: currentVersion,
      },
      {
        $set: {
          webhookUrl,
          secretToken,
          failed: false,
          updatedAt: now,
          version: currentVersion + 1,
        },
      },
    );

    if (result.modifiedCount > 0) {
      this.getCurrentVersion.set(currentVersion + 1, botId);
    }

    return { success: result.modifiedCount > 0 };
  }

  public async setWebhookFailed(botId: string) {
    await this.ready;

    const now = new Date();

    const currentVersion = await this.getCurrentVersion(botId);

    if (currentVersion === null) {
      return;
    }

    const result = await this.collection.updateOne(
      {
        botId,
        version: currentVersion,
      },
      {
        $set: {
          failed: true,
          failureDetectedAt: now,
          updatedAt: now,
          version: currentVersion + 1,
        },
      },
    );

    if (result.modifiedCount > 0) {
      this.getCurrentVersion.set(currentVersion + 1, botId);
    }
  }

  // New API-first methods
  public async updateWithTiming(
    botId: string,
    webhookUrl: string,
    secretToken: string,
    apiCallAt: Date,
    apiRespAt: Date,
    webhookChanged: boolean,
  ): Promise<{ success: boolean; conflict?: boolean; reason?: string }> {
    await this.ready;

    if (!webhookChanged) {
      // Webhook didn't change, no database update needed
      return { success: true };
    }

    const now = new Date();

    // First, check if record exists
    const existingRecord = await this.collection.findOne({ botId });

    if (!existingRecord) {
      // No existing record - use createWithTiming method
      const createResult = await this.createWithTiming(botId, webhookUrl, secretToken, apiCallAt, apiRespAt);
      
      if (createResult.success) {
        return { success: true };
      } else {
        // Race condition - another process created the record, try to update instead
        return this.updateWithTiming(botId, webhookUrl, secretToken, apiCallAt, apiRespAt, webhookChanged);
      }
    }

    // Record exists - check timing for conflict resolution
    const filter = {
      botId,
      // Only update if our API call is newer than the last recorded call
      $or: [
        { apiCallAt: { $lt: apiCallAt } },
        { apiCallAt: { $exists: false } },
      ],
    };

    const update = {
      $set: {
        webhookUrl,
        secretToken,
        failed: false,
        updatedAt: now,
        apiCallAt,
        apiRespAt,
        dbUpdateAt: now,
        lastWebhookUrl: webhookUrl,
        version: { $inc: 1 },
      },
    };

    // Try to update with timing-based conflict resolution
    const result = await this.collection.updateOne(filter, update);

    if (result.modifiedCount > 0) {
      // Update cache
      const currentVersion = await this.getCurrentVersion(botId);
      if (currentVersion !== null) {
        this.getCurrentVersion.set(currentVersion + 1, botId);
      }
      return { success: true };
    }

    // Conflict detected - someone else made a newer API call
    return {
      success: false,
      conflict: true,
      reason: "newer_api_call_exists",
    };
  }

  public async createWithTiming(
    botId: string,
    webhookUrl: string,
    secretToken: string,
    apiCallAt: Date,
    apiRespAt: Date,
  ): Promise<{ success: boolean }> {
    await this.ready;

    const now = new Date();

    try {
      await this.collection.insertOne({
        botId,
        webhookUrl,
        secretToken,
        failed: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
        apiCallAt,
        apiRespAt,
        dbUpdateAt: now,
        lastWebhookUrl: webhookUrl,
      });

      this.getCurrentVersion.set(1, botId);
      return { success: true };
    } catch (error: any) {
      // Handle duplicate key error (race condition)
      if (error.code === 11000) {
        return { success: false };
      }
      throw error;
    }
  }

  public async forceUpdateWithTiming(
    botId: string,
    webhookUrl: string,
    secretToken: string,
    apiCallAt: Date,
    apiRespAt: Date,
  ): Promise<{ success: boolean }> {
    await this.ready;

    const now = new Date();

    const result = await this.collection.updateOne(
      { botId },
      {
        $set: {
          webhookUrl,
          secretToken,
          failed: false,
          updatedAt: now,
          apiCallAt,
          apiRespAt,
          dbUpdateAt: now,
          lastWebhookUrl: webhookUrl,
          version: { $inc: 1 },
        },
      },
    );

    if (result.modifiedCount > 0) {
      const currentVersion = await this.getCurrentVersion(botId);
      if (currentVersion !== null) {
        this.getCurrentVersion.set(currentVersion + 1, botId);
      }
    }

    return { success: result.modifiedCount > 0 };
  }
}
