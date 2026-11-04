import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createCodePlugin, type HighlightResult, type ThemeInput } from '@streamdown/code';
import {
  CodeBlockContainer,
  CodeBlockHeader,
  defaultComponents,
  extractTableDataFromElement,
  tableDataToMarkdown,
  useIsCodeFenceIncomplete,
  type Components,
} from 'streamdown';
import { CopyButton } from '@/components/ui/copy-button';
import { ScrollArea } from '@/components/ui/scroll-area';

const syntax = (name: string) => `var(--syntax-${name})`;
const token = (scope: string[], name: string) => ({ scope, settings: { foreground: syntax(name) } });

/**
 * The highlighter's colours are the `--syntax-*` tokens (global.css), not hex: the theme only
 * says which kind of token takes which token, so the palette stays in one place.
 */
const SYNTAX_THEME = {
  name: 'panel-syntax',
  type: 'light',
  colors: { 'editor.foreground': syntax('text'), 'editor.background': '#0000' },
  tokenColors: [
    token(['comment', 'punctuation.definition.comment'], 'comment'),
    token(['keyword', 'storage', 'storage.type', 'keyword.operator.new', 'keyword.control'], 'keyword'),
    token(['string', 'string.quoted', 'punctuation.definition.string'], 'string'),
    token(['constant.numeric', 'constant.language', 'constant.character', 'constant.other'], 'number'),
    token(['entity.name.function', 'support.function', 'meta.function-call'], 'function'),
    token(['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], 'type'),
    token(['entity.name.tag', 'support.class.component', 'invalid'], 'tag'),
    token(['entity.other.attribute-name', 'variable.parameter', 'support.type.property-name'], 'attribute'),
    token(['punctuation', 'meta.brace', 'keyword.operator'], 'punctuation'),
    token(['markup.inserted', 'meta.diff.header.to-file'], 'inserted'),
    token(['markup.deleted', 'meta.diff.header.from-file'], 'deleted'),
  ],
} as ThemeInput;

/** Shiki in the panel: highlighting loads per language on first use. */
export const codePlugin = createCodePlugin({ themes: [SYNTAX_THEME, SYNTAX_THEME] });

type ShikiLanguage = Parameters<typeof codePlugin.supportsLanguage>[0];

/** The highlighted tokens of `code`, or null while the language loads (or has no grammar). */
function useTokens(code: string, language: string, incomplete: boolean): HighlightResult | null {
  const [result, setResult] = useState<HighlightResult | null>(null);
  useEffect(() => {
    if (!codePlugin.supportsLanguage(language as ShikiLanguage)) {
      setResult(null);
      return;
    }
    let current = true;
    const ready = codePlugin.highlight(
      { code, language: language as ShikiLanguage, isIncomplete: incomplete, themes: codePlugin.getThemes() },
      (late) => current && setResult(late),
    );
    if (ready) setResult(ready);
    return () => {
      current = false;
    };
  }, [code, language, incomplete]);
  return result;
}

const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;

function CodeLines({ code, result }: { code: string; result: HighlightResult | null }) {
  if (!result) return code;
  return result.tokens.map((line, row) => (
    // Lines never reorder, so their position is their identity.
    <span key={row}>
      {line.map((part, column) => {
        const style = part.fontStyle ?? 0;
        return (
          <span
            key={column}
            style={{
              color: part.color,
              fontStyle: style & ITALIC ? 'italic' : undefined,
              fontWeight: style & BOLD ? 600 : undefined,
              textDecorationLine: style & UNDERLINE ? 'underline' : undefined,
            }}
          >
            {part.content}
          </span>
        );
      })}
      {row < result.tokens.length - 1 ? '\n' : null}
    </span>
  ));
}

/**
 * A fenced code block: Streamdown's container and header, our CopyButton, and the code in a
 * ScrollArea. It scrolls sideways only (no height cap, so a long block simply grows), with a long
 * fade at whichever edge has more to show.
 */
function CodeBlockView({ code, language }: { code: string; language: string }) {
  const incomplete = useIsCodeFenceIncomplete();
  const source = code.replace(/\n$/, '');
  const result = useTokens(source, language, incomplete);
  return (
    <CodeBlockContainer language={language} isIncomplete={incomplete}>
      <CodeBlockHeader language={language} />
      <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center">
        <div data-streamdown="code-block-actions" className="pointer-events-auto flex shrink-0 items-center">
          <CopyButton text={source} label="Copy code" />
        </div>
      </div>
      <ScrollArea horizontal fade="x" data-streamdown="code-block-body" data-language={language}>
        <pre className="px-3.5 pb-3.5 whitespace-pre">
          <code>
            <CodeLines code={source} result={result} />
          </code>
        </pre>
      </ScrollArea>
    </CodeBlockContainer>
  );
}

const LANGUAGE = /language-([^\s]+)/;

/** The fence's text: Streamdown hands it over as a string, or inside one element. */
function fenceText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  const inner = (children as { props?: { children?: unknown } } | null)?.props?.children;
  return typeof inner === 'string' ? inner : '';
}

const InlineCode = defaultComponents.code;

/** Code in a reply: a block gets the ScrollArea version, inline code stays Streamdown's. */
const ReplyCode: Components['code'] = (props) => {
  if ('data-block' in props) {
    return <CodeBlockView code={fenceText(props.children)} language={props.className?.match(LANGUAGE)?.[1] ?? ''} />;
  }
  return <InlineCode {...props} />;
};

/**
 * A table: no card, the rows in a ScrollArea that scrolls sideways only, with the same long fade.
 * Copy puts the table on the clipboard as Markdown.
 */
const ReplyTable: Components['table'] = ({ children, node: _node, ...props }) => {
  const table = useRef<HTMLTableElement>(null);
  const markdown = () => (table.current ? tableDataToMarkdown(extractTableDataFromElement(table.current)) : '');
  return (
    <div data-streamdown="table-wrapper">
      <div data-streamdown="table-actions">
        <CopyButton text={markdown} label="Copy table" />
      </div>
      <ScrollArea horizontal fade="x">
        <table ref={table} data-streamdown="table" className="w-full divide-y divide-border" {...props}>
          {children}
        </table>
      </ScrollArea>
    </div>
  );
};

export const BLOCK_COMPONENTS: Components = { code: ReplyCode, table: ReplyTable };
