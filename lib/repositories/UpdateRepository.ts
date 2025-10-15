import type { Update } from "@grammyjs/types";
import { BaseRepository } from "./BaseRepository";

export class UpdateRepository extends BaseRepository {
  async insert(update: Update) {
    await this.collection.insertOne(update);
  }
}
