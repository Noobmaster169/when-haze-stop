import { InputsTable } from "./inputs-table";
import { ModelChapter } from "./model-chapter";
import { Formula, H3 } from "./prose";
import { WorkedExample } from "./worked-example";

/** What goes in: the function as a formula, its inputs by group, and one real row run through it. */

const FUNCTION = `ŷq(i, t) = Fq(x) = Σ k=1..600 Tk(x)      q in {0.10, 0.50, 0.90}, one Fq per target day

x: 108 numbers known at 08:00 on day t. Each tree Tk splits on a few of them and returns a leaf value.
The 50th percentile is the forecast; the 10th and 90th are the band.`;

export function FunctionChapter() {
  return (
    <ModelChapter id="inputs">
      <Formula>{FUNCTION}</Formula>
      <H3>The 108 inputs</H3>
      <InputsTable />
      <H3>One real row: Shah Alam, issued 7 October 2026 at 08:00</H3>
      <WorkedExample />
    </ModelChapter>
  );
}
