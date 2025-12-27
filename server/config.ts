export const config = {
  development: process.env.NODE_ENV !== "production",
  port: process.env.PORT || 3000,
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
};
