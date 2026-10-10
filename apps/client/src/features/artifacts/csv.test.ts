import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("CSV file viewer", () => {
  it("keeps quoted delimiters, escaped quotes, and embedded newlines in their cells", () => {
    expect(
      parseCsv('name,note\r\n"Ada, A.","said ""hello""\nand left"\r\n'),
    ).toEqual([
      ["name", "note"],
      ["Ada, A.", 'said "hello"\nand left'],
    ]);
  });
  it("preserves empty cells and does not add a row for the trailing newline", () => {
    expect(parseCsv("a,b,c\n1,,\n")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
    ]);
    expect(parseCsv("")).toEqual([]);
  });
});
