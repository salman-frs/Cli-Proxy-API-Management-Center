import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconCornerDownLeft, IconSearch } from '@/components/ui/icons';
import styles from './CommandPalette.module.scss';

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  hint?: string;
  keywords?: string[];
  active?: boolean;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
}

const matchesQuery = (item: CommandItem, query: string) => {
  if (!query) return true;
  const haystack = [item.label, item.group, item.hint ?? '', ...(item.keywords ?? [])]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

export function CommandPalette({ open, items, onClose }: CommandPaletteProps) {
  if (!open) return null;
  return createPortal(<CommandPaletteDialog items={items} onClose={onClose} />, document.body);
}

function CommandPaletteDialog({ items, onClose }: Omit<CommandPaletteProps, 'open'>) {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => items.filter((item) => matchesQuery(item, query)), [items, query]);
  const groups = useMemo(() => {
    const byGroup = new Map<string, Array<{ item: CommandItem; index: number }>>();
    results.forEach((item, index) =>
      byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), { item, index }])
    );
    return Array.from(byGroup.entries());
  }, [results]);
  const highlightedIndex = Math.min(highlighted, Math.max(results.length - 1, 0));

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const runItem = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    item.onSelect();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((highlightedIndex + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((highlightedIndex - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runItem(results[highlightedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      event.preventDefault();
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.command_palette')}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.searchRow}>
          <IconSearch size={16} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            placeholder={t('shell.search_placeholder')}
            aria-label={t('shell.search_placeholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${highlightedIndex}` : undefined}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="kbd">esc</kbd>
        </div>

        <div className={styles.list} id={listId} role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <div className={styles.empty}>{t('shell.no_results')}</div>
          ) : (
            groups.map(([group, groupItems]) => (
              <div className={styles.group} key={group} role="group" aria-label={group}>
                <div className={styles.groupLabel}>{group}</div>
                {groupItems.map(({ item, index }) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <div
                      key={item.id}
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isHighlighted}
                      className={`${styles.item} ${isHighlighted ? styles.itemHighlighted : ''}`}
                      onMouseMove={() => setHighlighted(index)}
                      onClick={() => runItem(item)}
                    >
                      <span className={styles.itemIcon}>{item.icon}</span>
                      <span className={styles.itemLabel}>{item.label}</span>
                      {item.active ? (
                        <span className={styles.itemActive} aria-hidden="true" />
                      ) : null}
                      {item.hint ? <span className={styles.itemHint}>{item.hint}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            {t('shell.hint_navigate')}
          </span>
          <span className={styles.footerHint}>
            <kbd className="kbd">
              <IconCornerDownLeft size={11} />
            </kbd>
            {t('shell.hint_select')}
          </span>
        </div>
      </div>
    </div>
  );
}
