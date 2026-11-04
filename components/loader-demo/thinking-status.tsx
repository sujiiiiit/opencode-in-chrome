import SquiggleLoader from "@/components/ui/squiggle-loader";
import { TextLoop } from "@/components/ui/text-loop";
import { TextShimmer } from "@/components/ui/text-shimmer";

// Copied from openscreen-studio's transcribe tab (src/components/layout/tabs/transcribe/generate/index.tsx).
export function ThinkingStatus() {
  return (
    <div
      className=" text-sm flex gap-2 items-center "
      style={
        {
          // The shimmer colours from openscreen-studio's theme.css; without them the shimmer is invisible.
          "--shimmer-text-faded-color": "#d4d3cf",
          "--shimmer-text-highlight-color": "#86837e",
        } as React.CSSProperties
      }
    >
      <SquiggleLoader strokeColor="#86837e" />
      <TextLoop>
        <TextShimmer>Preparing</TextShimmer>
        <TextShimmer>Analyzing</TextShimmer>
        <TextShimmer>Thinking</TextShimmer>
        <TextShimmer>Generating</TextShimmer>
        <span className="text-(--shimmer-text-highlight-color)">
          Took 3 min to generate
        </span>
      </TextLoop>
    </div>
  );
}
