import { bool, cleanEnv, host, port, str, url } from "envalid";

export const env = cleanEnv(process.env, {
  PORT: port({ default: 3000 }),
  HOST: host({ default: "0.0.0.0" }),
  TRANSMITTER_ORIGIN: url({ default: "http://localhost:3000" }),
  MONGO_URL: url({ default: "mongodb://localhost:27017/" }),
  MONGO_USER: str({ default: "admin" }),
  MONGO_PASSWORD: str({ default: "admin" }),
});
