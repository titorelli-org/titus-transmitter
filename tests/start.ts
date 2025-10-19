import { main } from "../index";
import { createDummyTelegramApiServer } from "./mocks";
import { MongoClient } from "mongodb";

const start = async () => {
  const telegramApiServer = createDummyTelegramApiServer();

  const service = await main({
    telegramBaseUrl: "http://localhost:3001",
    mongoUrl: "mongodb://admin:admin@localhost:27017/",
  });

  // const mongoClient = await MongoClient.connect("mongodb://localhost:27017/", {
  //   directConnection: true,
  //   auth: {
  //     username: "admin",
  //     password: "admin",
  //   },
  // });

  const shutdown = async () => {
    await telegramApiServer.close();
    await service.stop();

    // console.log("Closing MongoDB client...");
    // await mongoClient.close();
    // console.log("MongoDB client closed");

    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("uncaughtException", shutdown);
  process.on("unhandledRejection", shutdown);

  await telegramApiServer.listen(
    {
      port: 3001,
      host: "0.0.0.0",
    },
    () => {
      console.log("Telegram API server is running on port 3001");
    },
  );

  await service.start();

  // const updatesCursor = mongoClient
  //   .db("titorelli")
  //   .collection("updates")
  //   .find();

  // for await (const update of updatesCursor) {
  //   await new Promise((resolve) => setTimeout(resolve, 500));

  //   const { status } = await fetch("http://localhost:3001/sendMessage", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       // botId: "--test-bot-token--",
  //       botId: "8209976975:AAH9kNAnThODwYBc6JdgBivsMkDd0Crkr1s",
  //       data: update,
  //     }),
  //   });

  //   console.log("status", status);
  // }
};

if (require.main === module) {
  start();
}
