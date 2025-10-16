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
}
