import Redis from 'ioredis';

export const redis = new Redis(process.env.KEYDB_URL ?? '');