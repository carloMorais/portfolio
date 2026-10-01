import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Local dev stays in the 17xxx range (see CLAUDE.md); Render injects its own PORT in production.
const DEV_PORT = 17100;

// The web app's own production URL plus its Vercel preview URLs and local dev ports,
// since the browser calling this API is either the live site, a release preview, or localhost.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://portfolio-carlomorais.vercel.app",
  "http://localhost:17000",
  "http://localhost:17001",
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const extraOrigins = process.env.WEB_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      ...DEFAULT_ALLOWED_ORIGINS,
      ...(extraOrigins ?? []),
      // Vercel preview deployments, one per push to `release`.
      /^https:\/\/portfolio-[a-z0-9-]+\.vercel\.app$/,
    ],
  });

  const port = process.env.PORT ? Number(process.env.PORT) : DEV_PORT;
  await app.listen(port);
}

bootstrap();
