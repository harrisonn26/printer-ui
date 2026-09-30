<script lang="ts">
  import { untrack } from 'svelte'
  import { basicSetup } from 'codemirror'
  import { EditorState, type Extension } from '@codemirror/state'
  import { EditorView, keymap } from '@codemirror/view'
  import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
  import { tags } from '@lezer/highlight'
  import { klipperConfig } from '../lib/klipper-config-mode'

  interface Props {
    /** Which document is shown; each keeps its own undo history and cursor. */
    docKey: string
    /** The document's text when first opened. */
    initial: string
    readonly?: boolean
    onchange: (text: string) => void
    onsave?: () => void
  }

  let { docKey, initial, readonly = false, onchange, onsave }: Props = $props()

  let host: HTMLDivElement | undefined = $state()
  let view: EditorView | null = null
  const states = new Map<string, EditorState>()

  const highlight = HighlightStyle.define([
    { tag: tags.heading, color: 'var(--accent)', fontWeight: '700' },
    { tag: tags.propertyName, color: 'var(--text)' },
    { tag: tags.operator, color: 'var(--text-faint)' },
    { tag: tags.string, color: 'var(--text-muted)' },
    { tag: tags.number, color: 'var(--heat)' },
    { tag: tags.keyword, color: 'var(--series-3)', fontWeight: '600' },
    { tag: tags.meta, color: 'var(--series-7)' },
    { tag: tags.comment, color: 'var(--text-faint)', fontStyle: 'italic' }
  ])

  const theme = EditorView.theme({
    '&': { height: '100%', color: 'var(--text)', backgroundColor: 'var(--surface-inset)', fontSize: '13px' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
    '.cm-content': { caretColor: 'var(--accent)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
    '.cm-gutters': { backgroundColor: 'var(--surface-inset)', color: 'var(--text-faint)', border: 'none' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--control) 45%, transparent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft) !important' },
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--warning) 25%, transparent)' },
    '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' },
    '.cm-panels input, .cm-panels button': { fontFamily: 'var(--font-sans)' },
    '.cm-foldPlaceholder': { backgroundColor: 'var(--control)', border: 'none', color: 'var(--text-muted)' }
  })

  const extensions = (): Extension[] => [
    basicSetup,
    StreamLanguage.define(klipperConfig),
    syntaxHighlighting(highlight),
    theme,
    EditorState.readOnly.of(readonly),
    keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { onsave?.(); return true } }]),
    EditorView.updateListener.of(update => {
      if (update.docChanged) onchange(update.state.doc.toString())
    })
  ]

  const stateFor = (key: string, text: string) => states.get(key) ?? EditorState.create({ doc: text, extensions: extensions() })

  $effect(() => {
    if (!host) return
    view = new EditorView({ parent: host, state: untrack(() => stateFor(docKey, initial)) })
    return () => {
      view?.destroy()
      view = null
    }
  })

  // Switching files: park the current state, restore (or create) the next.
  let shownKey = untrack(() => docKey)
  $effect(() => {
    const key = docKey
    const text = initial
    if (!view || key === shownKey) return
    states.set(shownKey, view.state)
    view.setState(stateFor(key, text))
    shownKey = key
  })

  /** Replace a document's text (after a revert or restore); drops its undo history. */
  export const reset = (key: string, text: string) => {
    const state = EditorState.create({ doc: text, extensions: extensions() })
    states.set(key, state)
    if (view && key === shownKey) view.setState(state)
  }
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor { height: 100%; min-height: 0; overflow: hidden; }
  .editor :global(.cm-editor) { height: 100%; }
  .editor :global(.cm-editor.cm-focused) { outline: none; }
</style>
