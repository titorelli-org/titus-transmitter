import { type ObjectId } from "mongodb";
import { BaseRepository } from "./BaseRepository";
import { WebhookInfo } from "../telegram";

export type HookState = {
  _id: ObjectId;
  botId: string;
  botToken: string;
  secretToken: string;
  allowedUpdates: string[];
  url?: string;
  hasCustomCertificate?: boolean;
  pendingUpdateCount?: number;
  maxConnections?: number;
  ipAddress?: string;
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertHookStateParams = Omit<
  HookState,
  | "_id"
  | "createdAt"
  | "updatedAt"
  | "deleted"
  | "hasCustomCertificate"
  | "pendingUpdateCount"
  | "maxConnections"
  | "ipAddress"
>;

export type UpdateHookStateParams = Omit<
  HookState,
  "_id" | "createdAt" | "updatedAt" | "deleted" | "botToken" | "secretToken"
>;

export type SetDeletedParams = Pick<HookState, "botId">;

export class HookStateRepository extends BaseRepository {
  async initialize() {
    await this.collection.createIndex({ botId: 1 }, { unique: true });
  }

  public async upsert(hookState: UpsertHookStateParams) {
    const now = new Date();

    await this.collection.updateOne(
      { botId: hookState.botId },
      {
        $set: { ...hookState, deleted: false, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  public async update(hookState: UpdateHookStateParams) {
    await this.collection.updateOne(
      { botId: hookState.botId },
      {
        $set: {
          ...hookState,
          updatedAt: new Date(),
          deleted: false,
        },
      },
    );
  }

  public async delete({ botId }: SetDeletedParams) {
    await this.collection.updateOne(
      { botId },
      { $set: { deleted: true, updatedAt: new Date() } },
    );
  }

  public async findAll() {
    const cursor = this.collection.find<HookState>({ deleted: false });

    const hooks = [];

    for await (const hookState of cursor) {
      hooks.push(hookState);
    }

    return hooks;
  }

  public async forEach<T>(callback: (hookState: HookState) => Promise<T>) {
    const cursor = this.collection.find<HookState>({ deleted: false });

    for await (const hookState of cursor) {
      await callback(hookState);
    }
  }
}
