import type { Update } from "@grammyjs/types";
import type { ObjectId } from "mongodb";
import { BaseRepository } from "./BaseRepository";

export type BotState = {
  _id: ObjectId;
  botId: string;
  receivedUpdatesCount: number;
  lastReceivedUpdateAt: Date;
  lastReceivedUpdateId: number;
  processedUpdatesCount: number;
  lastProcessedUpdateAt: Date | null;
  lastProcessedUpdateId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class BotStateRepository extends BaseRepository {
  public async updateReceived(botId: string, update: Update) {
    const now = new Date();

    await this.collection.updateOne(
      { botId },
      {
        $set: {
          botId,
          lastReceivedUpdateAt: now,
          lastReceivedUpdateId: update.update_id,
          receivedUpdatesCount: { $inc: 1 },
          updatedAt: now,
        },
        $setOnInsert: {,
          processedUpdatesCount: 0,
          lastProcessedUpdateAt: null,
          lastProcessedUpdateId: null,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  public async updateProcessed(botId: string, updateId: Update["update_id"]) {
    const now = new Date();

    await this.collection.updateOne(
      { botId },
      {
        $set: {
          lastProcessedUpdateAt: now,
          lastProcessedUpdateId: updateId,
          processedUpdatesCount: { $inc: 1 },
          updatedAt: now,
        },
      },
    );
  }
}
