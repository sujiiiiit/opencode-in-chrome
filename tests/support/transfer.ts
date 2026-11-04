// A stand-in DataTransfer for paste and drag tests (happy-dom has no real clipboard or OS drag).

export const fileOf = (name: string, type = 'image/png') => new File([new Uint8Array([1, 2, 3])], name, { type });

type Options = {
  files?: File[];
  text?: string;
  /** Extra types (e.g. "text/html", "text/uri-list"); "Files" and "text/plain" follow the content. */
  types?: string[];
  /** Fill only `files`, not `items` (as some browsers do for a drop). */
  filesOnly?: boolean;
};

export function transfer({ files = [], text = '', types = [], filesOnly = false }: Options = {}) {
  return {
    types: [...(files.length ? ['Files'] : []), ...(text ? ['text/plain'] : []), ...types],
    getData: (format: string) => (format === 'text/plain' ? text : ''),
    items: filesOnly ? [] : files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    files,
    dropEffect: 'none' as string,
  };
}

/** A drag event as the browser sends it, carrying `data` (and the element entered, for a leave). */
export function dragEvent(type: string, data: ReturnType<typeof transfer> | null, relatedTarget: EventTarget | null = null) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: data });
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  return event as DragEvent;
}
