import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Link2,
  Code,
  Quote,
  Undo,
  Redo,
} from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// RichTextEditor
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon, label, isActive, disabled, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded p-0.5 transition-colors
        ${isActive
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-700 dark:hover:text-gray-100'}
        ${disabled ? 'pointer-events-none opacity-40' : ''}
      `}
    >
      {icon}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-gray-300 dark:bg-slate-600" />;
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', previousUrl ?? '');
    if (url === null) return; // cancelled

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const iconSize = 16;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-900/50">
      {/* Text formatting */}
      <ToolbarButton
        icon={<Bold size={iconSize} />}
        label="Bold (Ctrl+B)"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<Italic size={iconSize} />}
        label="Italic (Ctrl+I)"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<UnderlineIcon size={iconSize} />}
        label="Underline (Ctrl+U)"
        isActive={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={<Code size={iconSize} />}
        label="Inline code"
        isActive={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        icon={<Heading1 size={iconSize} />}
        label="Heading 1"
        isActive={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={<Heading2 size={iconSize} />}
        label="Heading 2"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={<Heading3 size={iconSize} />}
        label="Heading 3"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <ToolbarDivider />

      {/* Lists & block */}
      <ToolbarButton
        icon={<List size={iconSize} />}
        label="Bullet list"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<ListOrdered size={iconSize} />}
        label="Ordered list"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={<Quote size={iconSize} />}
        label="Blockquote"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <ToolbarDivider />

      {/* Link */}
      <ToolbarButton
        icon={<Link2 size={iconSize} />}
        label="Add link"
        isActive={editor.isActive('link')}
        onClick={setLink}
      />

      <ToolbarDivider />

      {/* History */}
      <ToolbarButton
        icon={<Undo size={iconSize} />}
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={<Redo size={iconSize} />}
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing…',
  editable = true,
  minHeight = '120px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync external content changes (e.g. form reset)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!editor) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    >
      {editable && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none dark:prose-invert px-3 py-2 focus:outline-none [&_.ProseMirror]:min-h-[var(--editor-min-height)] [&_.ProseMirror]:outline-none [&_.ProseMirror p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror p.is-editor-empty:first-child::before]:dark:text-slate-500"
        style={{ '--editor-min-height': minHeight } as React.CSSProperties}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineEditor
// ---------------------------------------------------------------------------

interface InlineEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function InlineEditor({
  content,
  onChange,
  placeholder = 'Type here…',
}: InlineEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'min-h-[1.5em] outline-none px-2 py-1 text-sm dark:text-gray-200',
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (!editor) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <EditorContent editor={editor} />
    </div>
  );
}
