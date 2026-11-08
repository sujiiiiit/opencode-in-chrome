type Point = { x: number; y: number };
type Line = { left: number; right: number; top: number; bottom: number };

/** One continuous silhouette around the text's line fragments, including concave corners. */
export function mentionShape(lines: Line[], radius = 8): string {
  if (!lines.length) return '';
  const right: Point[] = [];
  const left: Point[] = [];
  const leftEdge = Math.min(...lines.map((line) => line.left));
  const rightEdge = Math.max(...lines.map((line) => line.right));
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    const next = lines[index + 1];
    const top = previous ? (previous.bottom + line.top) / 2 : line.top - 2;
    const bottom = next ? (line.bottom + next.top) / 2 : line.bottom + 2;
    // Near-equal edges share a straight side instead of producing tiny notches.
    const end = rightEdge - line.right < radius * 2 ? rightEdge : line.right;
    const start = line.left - leftEdge < radius * 2 ? leftEdge : line.left;
    right.push({ x: end + 3, y: top }, { x: end + 3, y: bottom });
    left.push({ x: start - 3, y: top }, { x: start - 3, y: bottom });
  });
  const outline = [...right, ...left.reverse()];
  const points = outline.filter((point, index) => {
    const previous = outline[(index + outline.length - 1) % outline.length]!;
    const next = outline[(index + 1) % outline.length]!;
    return (point.x - previous.x) * (next.y - point.y) !== (point.y - previous.y) * (next.x - point.x);
  });
  return roundedOutline(points, radius);
}

function roundedOutline(points: Point[], radius: number): string {
  const corners = points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]!;
    const next = points[(index + 1) % points.length]!;
    const incoming = Math.hypot(previous.x - point.x, previous.y - point.y);
    const outgoing = Math.hypot(next.x - point.x, next.y - point.y);
    const inset = Math.min(radius, incoming / 2, outgoing / 2);
    const toward = (other: Point, distance: number) => ({ x: point.x + (other.x - point.x) * inset / distance, y: point.y + (other.y - point.y) * inset / distance });
    return { point, start: toward(previous, incoming), end: toward(next, outgoing) };
  });
  return corners.map(({ point, start, end }, index) => `${index === 0 ? 'M' : 'L'}${start.x},${start.y} Q${point.x},${point.y} ${end.x},${end.y}`).join(' ') + ' Z';
}
