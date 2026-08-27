import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleSSESubscription } from "../realtimeEvents";

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled Rejection:", reason);
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // The hosting proxy is the first trusted hop. This keeps req.ip useful for
  // abuse controls without trusting arbitrary client-supplied proxy headers.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  app.use("/api/trpc", (req, res, next) => {
    if (!/^\/auth\.(login|register|resetPassword)$/.test(req.path)) {
      next();
      return;
    }
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = authAttempts.get(key);
    if (!current || current.resetAt <= now) {
      authAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      next();
      return;
    }
    current.count += 1;
    if (current.count > 10) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      res.status(429).json({ error: "Too many authentication attempts. Try again later." });
      return;
    }
    next();
  });
  registerStorageProxy(app);

  // Real-time Server-Sent Events (SSE) route
  app.get("/api/events", handleSSESubscription);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  const isProduction = process.env.NODE_ENV === "production" || import.meta.url.includes("dist");
  if (isProduction) {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port} (http://0.0.0.0:${port})`);
  });
}

startServer().catch(console.error);
