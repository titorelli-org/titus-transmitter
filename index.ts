import { env } from "./lib/env";
import { logger } from "./lib/logger";
import {
  BotStateRepository,
  HookStateRepository,
  UpdateRepository,
} from "./lib/repositories";
import { TitusTransmitter } from "./lib/service";
import { MongoClient } from "mongodb";

export const main = async ({
  mongoUrl = env.MONGO_URL,
  telegramBaseUrl,
}: {
  mongoUrl?: string;
  telegramBaseUrl?: string;
} = {}) => {
  const mongoClient = await MongoClient.connect(mongoUrl, {
    auth: {
      username: env.MONGO_USER,
      password: env.MONGO_PASSWORD,
    },
  });

  return new TitusTransmitter({
    port: env.PORT,
    host: env.HOST,
    telegram: {
      baseUrl: telegramBaseUrl,
    },
    botStateRepository: new BotStateRepository({
      collection: mongoClient.db("transmitter").collection("bot_states"),
      logger: logger,
    }),
    hookStateRepository: new HookStateRepository({
      collection: mongoClient.db("transmitter").collection("hook_states"),
      logger: logger,
    }),
    updateRepository: new UpdateRepository({
      collection: mongoClient.db("transmitter").collection("updates"),
      logger: logger,
    }),
    logger: logger,
  });
};
