/**
 * Request-body validation for API routes.
 *
 * Every POST/PUT/PATCH route should declare a Zod schema for its body and
 * validate it through `validateBody`. This converts the audit's identified
 * "bodies are typed by hope" failure mode into a clean 400 at the boundary
 * with field-level error detail.
 *
 * Why this matters: `await request.json()` returns `any`. Without a Zod
 * schema, the TS types we write on `body.foo` are wishes — at runtime the
 * caller can send anything. That's how `brandTerms: "foo"` (a string) ends
 * up `JSON.stringify`'d and stored as `"foo"`, and how downstream parsers
 * silently fall through to `[]`.
 *
 * Usage:
 *   const parsed = await validateBody(request, ClientCreateSchema);
 *   if (parsed instanceof NextResponse) return parsed;
 *   // `parsed` is now strongly typed.
 */

import { NextResponse } from "next/server";
import type { ZodType, ZodError } from "zod";

export type ValidationFailure = NextResponse;

/**
 * Validate the JSON body of a Request against a Zod schema.
 *
 * Returns the parsed, validated payload on success.
 * Returns a 400 NextResponse with structured error detail on failure — callers
 * should check `instanceof NextResponse` and return it directly.
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T | ValidationFailure> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        // Compact, machine-readable list of {path, message} pairs. Avoids
        // dumping the full Zod error tree (verbose and leaks schema shape
        // back to potentially-untrusted callers).
        issues: formatZodIssues(result.error),
      },
      { status: 400 },
    );
  }

  return result.data;
}

function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(body)",
    message: issue.message,
  }));
}
