import type { Collection } from "mongodb";
import type { Logger } from "pino";

export type BaseRepositoryConfig = {
  collection: Collection;
  logger: Logger;
};

export class BaseRepository {
  private readonly _collection: Collection;
  private readonly _logger: Logger;
  private readonly _ready: Promise<void>;

  constructor({ collection, logger }: BaseRepositoryConfig) {
    this._collection = collection;
    this._logger = logger;
    this._ready = this.initialize();
  }

  get collection() {
    return this._collection;
  }

  get logger() {
    return this._logger;
  }

  get ready() {
    return this._ready;
  }

  public async initialize() {}
}
