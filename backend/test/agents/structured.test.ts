import { describe, expect, it } from "vitest";
import { z } from "zod";

import { valueSoFar } from "../../src/agents/chat/partial";
import { conversationTitle } from "../../src/agents/chat/title";
import { argsSignature } from "../../src/agents/chat/tools/args-signature";
import { extractJson, toOutputSchema } from "../../src/agents/structured";

describe("structured output helpers", () => {
  it("finds the object in prose or a fence", () => {
    expect(extractJson('thinking...\n{"a": 1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a": "}"}\n```')).toEqual({ a: "}" });
    expect(extractJson("no json here")).toBeUndefined();
  });

  it("refuses a top-level union before the provider does", () => {
    const union = z.discriminatedUnion("kind", [z.object({ kind: z.literal("a") }), z.object({ kind: z.literal("b") })]);
    expect(() => toOutputSchema(union)).toThrow(/cannot be a union/);
  });

  it("lets a defaulted field be left out only when asked to", () => {
    const schema = z.object({ action: z.string(), answer: z.string().default("") });
    expect(toOutputSchema(schema).required).toEqual(["action", "answer"]);
    expect(toOutputSchema(schema, true).required).toEqual(["action"]);
  });

  it("reads one field out of JSON that is still being written", () => {
    expect(valueSoFar('{"action":"final","answer":"Hel', "answer")).toBe("Hel");
    expect(valueSoFar('{"action":"fin', "answer")).toBe("");
    expect(valueSoFar('{"note":"answer","answer":"a\\nb', "answer")).toBe("a\nb");
  });

  it("writes a tool's arguments as a line the model can copy", () => {
    expect(argsSignature(z.object({ name: z.string(), limit: z.number().int().default(5) }))).toBe("{ name: string, limit?: number }");
  });

  it("titles a conversation from its first question", () => {
    expect(conversationTitle("What time is it right now in Singapore?")).toBe("What time is it right");
    expect(conversationTitle("   ")).toBe("A new question");
  });
});
