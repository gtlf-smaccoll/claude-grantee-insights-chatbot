/**
 * Embeddings module — NOT CURRENTLY USED.
 *
 * The Pinecone index uses integrated inference (llama-text-embed-v2),
 * so Pinecone handles embedding generation automatically.
 * We send raw text to Pinecone via upsertRecords/searchRecords.
 *
 * This file is kept as a placeholder in case we switch to
 * a standalone embedding provider (Voyage AI, OpenAI, etc.) in the future.
 */

export {};
