package pt.ecrop.wall;

/** A user-facing error body — always Portuguese, warm, never a raw validation message. */
public record ApiError(String message) {}
