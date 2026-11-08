import { useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { AnimatedDoodle, Doodle, DOODLE_NAMES } from '@/components/ui/doodle';
import { useTextColor } from '@/components/ui/use-text-color';

const SIZES = [24, 48, 96];
const WEIGHTS = [0, 0.5, 1, 1.5];
const MOTIONS = ['Animated', 'Static'];
// Text colours from global.css; the canvas takes whichever one the grid is wearing.
type Tone = { id: string; label: string; className: string };
const PRIMARY: Tone = { id: 'primary', label: 'Primary', className: 'text-text-primary' };
const COLORS: Tone[] = [
  PRIMARY,
  { id: 'secondary', label: 'Secondary', className: 'text-text-secondary' },
  { id: 'red', label: 'Red', className: 'text-red-text' },
  { id: 'orange', label: 'Orange', className: 'text-orange-text' },
  { id: 'yellow', label: 'Yellow', className: 'text-yellow-text' },
  { id: 'green', label: 'Green', className: 'text-green-text' },
  { id: 'teal', label: 'Teal', className: 'text-teal-text' },
  { id: 'blue', label: 'Blue', className: 'text-blue-text' },
  { id: 'purple', label: 'Purple', className: 'text-purple-text' },
  { id: 'pink', label: 'Pink', className: 'text-pink-text' },
  { id: 'brown', label: 'Brown', className: 'text-brown-text' },
];

/** A row of toggle buttons where exactly one is pressed. */
function Choice<T>({ label, options, value, onChange, render, labelOf, size = 'sm' }: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  render: (option: T) => ReactNode;
  labelOf?: (option: T) => string;
  size?: 'sm' | 'icon';
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs text-text-secondary">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((option, i) => (
          <Button
            key={i}
            type="button"
            size={size}
            variant={option === value ? 'secondary' : 'ghost'}
            aria-pressed={option === value}
            aria-label={labelOf?.(option)}
            onClick={() => onChange(option)}
          >
            {render(option)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A row of colour swatches, one per text colour in global.css. */
function ColorChoice({ value, onChange }: { value: Tone; onChange: (tone: Tone) => void }) {
  return (
    <Choice
      label="Colour"
      size="icon"
      options={COLORS}
      value={value}
      onChange={onChange}
      labelOf={(c) => c.label}
      render={(c) => <span className={cn('size-4 rounded-full bg-current', c.className)} />}
    />
  );
}

/** Every doodle at one square size, animated or still, with pickers for size, line weight and colour. */
export function DoodlesSection() {
  const [size, setSize] = useState(48);
  const [weight, setWeight] = useState(0);
  const [motion, setMotion] = useState('Animated');
  const Shown = motion === 'Animated' ? AnimatedDoodle : Doodle;
  const [tone, setTone] = useState(PRIMARY);
  const [box, color] = useTextColor<HTMLDivElement>(tone.id);

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-text-primary">
        <Choice label="Motion" options={MOTIONS} value={motion} onChange={setMotion} render={(v) => v} />
        <Choice label="Size" options={SIZES} value={size} onChange={setSize} render={(v) => `${v}px`} />
        <Choice label="Weight" options={WEIGHTS} value={weight} onChange={setWeight} render={(v) => (v ? `+${v}px` : 'Regular')} />
        <ColorChoice value={tone} onChange={setTone} />
      </div>
      <div ref={box} className={cn('grid grid-cols-4 gap-3 lg:grid-cols-5', tone.className)}>
        {color &&
          DOODLE_NAMES.map((name) => (
            <figure key={name} className="flex flex-col items-center gap-2 rounded-2xl border border-border p-4">
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-background-secondary">
                <Shown name={name} size={size} weight={weight} color={color} />
              </div>
              <figcaption className="text-xs text-text-secondary capitalize">{name}</figcaption>
            </figure>
          ))}
      </div>
    </div>
  );
}
