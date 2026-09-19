// Mirrors the API's WallResponse/PostDto/PromptDto (apps/api/.../wall/*.java). Timestamps are
// epoch millis on the wire, matching the DB clock — no timezone parsing on this side.

export interface Post {
  id: number;
  name: string | null;
  message: string;
  type: string;
  pinned: boolean;
  hidden: boolean;
  upvotes: number;
  createdAt: number;
  answerText: string | null;
  answerUpdatedAt: number | null;
}

export interface Prompt {
  id: number;
  text: string;
}

export interface WallResponse {
  prompt: Prompt | null;
  posts: Post[];
  removedIds: number[];
  serverTime: number;
}
